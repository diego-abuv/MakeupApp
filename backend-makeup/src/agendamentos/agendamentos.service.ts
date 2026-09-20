import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { fromZonedTime } from 'date-fns-tz';
import {
  cpfValido,
  CriarAgendamentoDto,
  somenteDigitos,
} from './dto/criar-agendamento.dto';
import { AtualizarStatusAgendamentoDto } from './dto/atualizar-status-agendamento.dto';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import {
  AgendamentoComServico,
  AgendamentoRow,
  AgendamentoStatus,
  Database,
} from '../types/database';
import {
  INICIO_EXPEDIENTE_HORAS,
  FIM_EXPEDIENTE_HORAS,
} from '../horario.config';
import {
  FUSO_HORARIO,
  INTERVALO_SLOTS_MINUTOS,
  formatarHoraLocal,
  parseDataLocal,
} from '../horario.util';
import {
  SINAL_PERCENTUAL,
  SINAL_TTL_MINUTOS,
} from '../makeup.config';

const STATUS_SEGURA_AGENDA: AgendamentoStatus[] = [
  'CONFIRMADO',
  'AGUARDANDO_SINAL',
];

const CAMPOS_AGENDA = '*, servicos(nome, preco, duracao_minutos, categoria)';

interface Intervalo {
  inicio: Date;
  fim: Date;
}

interface BloqueioLinha {
  data_hora_inicio: string;
  data_hora_fim: string;
  recorrente?: boolean | null;
  dia_semana?: number | null;
}

export interface SlotDisponibilidade {
  hora: string;
  disponivel: boolean;
}

export interface AgendamentoCriado extends AgendamentoRow {
  sinal_valor: number;
  sinal_expiracao: string;
  servicos?: Pick<
    AgendamentoComServico['servicos'] extends infer S ? NonNullable<S> : never,
    'nome' | 'preco'
  >;
}

function colide(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && a.fim > b.inicio;
}

function gerarSlots(
  data: string,
  duracaoMinutos: number,
  horaInicio: string,
  horaFim: string,
): Intervalo[] {
  const slots: Intervalo[] = [];
  const inicioExpediente = parseDataLocal(data, horaInicio);
  const fimExpediente = parseDataLocal(data, horaFim);
  let cursor = inicioExpediente;

  for (let i = 0; i < 500; i++) {
    const fim = new Date(cursor.getTime() + duracaoMinutos * 60000);
    if (Number.isNaN(fim.getTime()) || Number.isNaN(cursor.getTime())) break;
    if (fim > fimExpediente) break;
    slots.push({ inicio: new Date(cursor), fim });
    cursor = new Date(cursor.getTime() + INTERVALO_SLOTS_MINUTOS * 60000);
  }

  return slots;
}

@Injectable()
export class AgendamentosService {
  private readonly logger = new Logger(AgendamentosService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  private diaSemanaDe(data: string): number {
    const [ano, mes, dia] = data.split('-').map(Number);
    const local = new Date(ano, mes - 1, dia, 12);
    return local.getDay();
  }

  private intervaloRecorrente(
    bloqueio: BloqueioLinha,
    data: string,
  ): Intervalo {
    const horaInicio = formatarHoraLocal(new Date(bloqueio.data_hora_inicio));
    const horaFim = formatarHoraLocal(new Date(bloqueio.data_hora_fim));
    return {
      inicio: parseDataLocal(data, horaInicio),
      fim: parseDataLocal(data, horaFim),
    };
  }

  private async buscarServicoAtivo(
    servicoId: string,
  ): Promise<{ preco: number; duracao_minutos: number }> {
    const { data: servico, error: servicoError } = await this.supabase
      .from('servicos')
      .select('preco, duracao_minutos, ativo')
      .eq('id', servicoId)
      .single();

    if (servicoError || !servico) {
      throw new BadRequestException('Serviço não encontrado');
    }
    if (!servico.ativo) {
      throw new BadRequestException('Serviço indisponível');
    }
    return servico;
  }

  async liberarSinaisExpirados(): Promise<number> {
    const agora = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('agendamentos')
      .update({ status: 'EXPIRADO', pagamento_status: 'EXPIRADO' })
      .eq('status', 'AGUARDANDO_SINAL')
      .lt('sinal_expiracao', agora)
      .select('id');

    if (error) {
      this.logger.error(
        `Erro ao liberar sinais expirados: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException('Erro ao validar a agenda');
    }

    const quantidade = (data ?? []).length;
    if (quantidade > 0) {
      this.logger.log(`Liberados ${quantidade} sinal(is) expirado(s)`);
    }
    return quantidade;
  }

  async obterHorariosDisponiveis(
    servicoId: string,
    data: string,
  ): Promise<SlotDisponibilidade[]> {
    const servico = await this.buscarServicoAtivo(servicoId);

    const inicioDia = parseDataLocal(data, '00:00');
    const fimDia = parseDataLocal(data, '23:59');

    const { data: agendamentos, error: agendamentosError } = await this.supabase
      .from('agendamentos')
      .select('data_hora_inicio, data_hora_fim')
      .in('status', STATUS_SEGURA_AGENDA)
      .gt('data_hora_fim', inicioDia.toISOString())
      .lt('data_hora_inicio', fimDia.toISOString());

    const { data: bloqueios, error: bloqueiosError } = await this.supabase
      .from('bloqueios')
      .select('data_hora_inicio, data_hora_fim, recorrente, dia_semana')
      .gt('data_hora_fim', inicioDia.toISOString())
      .lt('data_hora_inicio', fimDia.toISOString());

    if (agendamentosError || bloqueiosError) {
      this.logger.error(
        `Erro ao consultar agenda: agendamentos=${agendamentosError?.code}:${agendamentosError?.message} bloqueios=${bloqueiosError?.code}:${bloqueiosError?.message}`,
      );
      throw new InternalServerErrorException('Erro ao consultar a agenda');
    }

    const { data: bloqueiosRecorrentes, error: recorrentesError } =
      await this.supabase
        .from('bloqueios')
        .select('data_hora_inicio, data_hora_fim, recorrente, dia_semana')
        .eq('recorrente', true);

    if (recorrentesError) {
      this.logger.error(
        `Erro ao consultar bloqueios recorrentes: code=${recorrentesError.code} message=${recorrentesError.message}`,
      );
      throw new InternalServerErrorException('Erro ao consultar a agenda');
    }

    const diaSemana = this.diaSemanaDe(data);

    // Buscar horário de expediente configurado para este dia da semana
    const { data: configDia } = await this.supabase
      .from('config_agenda')
      .select('hora_inicio, hora_fim')
      .eq('dia_semana', diaSemana)
      .maybeSingle();

    // Se não há config para este dia, o dia está inativo (sem slots)
    if (!configDia) {
      return [];
    }

    const { hora_inicio, hora_fim } = configDia;

    const recorrentesNoDia: Intervalo[] = (bloqueiosRecorrentes ?? [])
      .filter((b) => b.dia_semana === diaSemana)
      .map((b) => this.intervaloRecorrente(b, data));

    const ocupados: Intervalo[] = [
      ...(agendamentos ?? []).map((item) => ({
        inicio: new Date(item.data_hora_inicio),
        fim: new Date(item.data_hora_fim),
      })),
      ...(bloqueios ?? []).map((item) => ({
        inicio: new Date(item.data_hora_inicio),
        fim: new Date(item.data_hora_fim),
      })),
      ...recorrentesNoDia,
    ];

    return gerarSlots(data, servico.duracao_minutos, hora_inicio, hora_fim).map((slot) => ({
      hora: formatarHoraLocal(slot.inicio),
      disponivel: !ocupados.some((ocupado) => colide(slot, ocupado)),
    }));
  }

  async criarAgendamento(
    dto: CriarAgendamentoDto,
  ): Promise<AgendamentoRow> {
    const servico = await this.buscarServicoAtivo(dto.servicoId);

    if (!cpfValido(dto.clienteCpf)) {
      throw new BadRequestException('CPF inválido');
    }

    await this.liberarSinaisExpirados();

    const inicio = fromZonedTime(dto.dataHoraInicio, FUSO_HORARIO);
    if (Number.isNaN(inicio.getTime())) {
      throw new BadRequestException('Data e hora de início inválidas');
    }

    // Validar contra expediente configurado
    const diaSemanaVal = this.diaSemanaDe(dto.dataHoraInicio.slice(0, 10));
    const { data: configDia } = await this.supabase
      .from('config_agenda')
      .select('hora_inicio, hora_fim')
      .eq('dia_semana', diaSemanaVal)
      .maybeSingle();

    const horaInicio = configDia?.hora_inicio ?? `${INICIO_EXPEDIENTE_HORAS}:00`;
    const horaFim = configDia?.hora_fim ?? `${FIM_EXPEDIENTE_HORAS}:00`;

    const inicioExpediente = parseDataLocal(
      dto.dataHoraInicio.slice(0, 10),
      horaInicio,
    );
    if (inicio < inicioExpediente) {
      throw new BadRequestException(
        'Horário fora do expediente de atendimento',
      );
    }

    const fim = new Date(inicio.getTime() + servico.duracao_minutos * 60000);

    // RNF03 - validação de conflito no banco antes do INSERT (anti double-booking)
    const { data: conflitos, error: conflitosError } = await this.supabase
      .from('agendamentos')
      .select('id')
      .neq('status', 'CANCELADO')
      .neq('status', 'EXPIRADO')
      .lt('data_hora_inicio', fim.toISOString())
      .gt('data_hora_fim', inicio.toISOString());

    if (conflitosError) {
      throw new InternalServerErrorException('Erro ao validar a agenda');
    }

    if (conflitos && conflitos.length > 0) {
      throw new ConflictException('Horário já reservado para este período');
    }

    const { data: bloqueiosConflitantes, error: bloqueiosError } =
      await this.supabase
        .from('bloqueios')
        .select('id, data_hora_inicio, data_hora_fim, recorrente, dia_semana')
        .lt('data_hora_inicio', fim.toISOString())
        .gt('data_hora_fim', inicio.toISOString());

    if (bloqueiosError) {
      throw new InternalServerErrorException('Erro ao validar a agenda');
    }

    if (bloqueiosConflitantes && bloqueiosConflitantes.length > 0) {
      throw new ConflictException('Horário bloqueado para este período');
    }

    // Bloqueios recorrentes: aplicam-se ao mesmo dia da semana do agendamento
    const dataLocal = dto.dataHoraInicio.slice(0, 10);
    const diaSemana = this.diaSemanaDe(dataLocal);
    const { data: recorrentes, error: recorrentesError } = await this.supabase
      .from('bloqueios')
      .select('id, data_hora_inicio, data_hora_fim, recorrente, dia_semana')
      .eq('recorrente', true);

    if (recorrentesError) {
      throw new InternalServerErrorException('Erro ao validar a agenda');
    }

    const recorrentesNoDia = (recorrentes ?? []).filter(
      (b) => b.dia_semana === diaSemana,
    );

    if (recorrentesNoDia.length > 0) {
      const conflita = recorrentesNoDia.some((b) => {
        const intervalo = this.intervaloRecorrente(b, dataLocal);
        const novo: Intervalo = { inicio, fim };
        return colide(novo, intervalo);
      });
      if (conflita) {
        throw new ConflictException('Horário bloqueado para este período');
      }
    }

    const sinalValor = Number(
      (servico.preco * SINAL_PERCENTUAL).toFixed(2),
    );
    const sinalExpiracao = new Date(
      Date.now() + SINAL_TTL_MINUTOS * 60 * 1000,
    ).toISOString();

    const { data: criado, error: criadoError } = await this.supabase
      .from('agendamentos')
      .insert({
        cliente_nome: dto.clienteNome,
        cliente_whatsapp: somenteDigitos(dto.clienteWhatsapp),
        cliente_email: dto.clienteEmail.toLowerCase(),
        cliente_cpf: somenteDigitos(dto.clienteCpf),
        servico_id: dto.servicoId,
        data_hora_inicio: inicio.toISOString(),
        data_hora_fim: fim.toISOString(),
        status: 'AGUARDANDO_SINAL',
        pagamento_status: 'AGUARDANDO',
        sinal_valor: sinalValor,
        sinal_expiracao: sinalExpiracao,
      })
      .select()
      .single();

    if (criadoError) {
      this.logger.error(
        `Erro ao criar agendamento: code=${criadoError.code} message=${criadoError.message} servico=${dto.servicoId}`,
      );
      throw new InternalServerErrorException('Erro ao registrar o agendamento');
    }

    this.logger.log(
      `Agendamento criado: ${dto.clienteNome} servico=${dto.servicoId} ${dto.dataHoraInicio} sinal=${sinalValor}`,
    );

    return criado;
  }

  async listarMeusAgendamentos(
    whatsapp: string,
  ): Promise<AgendamentoComServico[]> {
    const apenasDigitos = whatsapp.replace(/\D/g, '');
    if (!apenasDigitos) {
      throw new BadRequestException('Informe o número de celular');
    }

    const { data: agendamentos, error } = await this.supabase
      .from('agendamentos')
      .select(CAMPOS_AGENDA)
      .eq('cliente_whatsapp', apenasDigitos)
      .order('data_hora_inicio', { ascending: true });

    if (error) {
      this.logger.error(
        `Erro ao consultar agendamentos do whatsapp ${apenasDigitos}: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException(
        'Erro ao consultar seus agendamentos',
      );
    }

    this.logger.log(
      `Consulta de agendamentos por celular ${apenasDigitos}: ${(agendamentos ?? []).length} resultado(s)`,
    );

    return (agendamentos ?? []) as AgendamentoComServico[];
  }

  async listarAgendaDoDia(data: string): Promise<AgendamentoComServico[]> {
    const inicioDia = parseDataLocal(data, '00:00');
    const fimDia = parseDataLocal(data, '23:59');

    const { data: agendamentos, error } = await this.supabase
      .from('agendamentos')
      .select(CAMPOS_AGENDA)
      .gt('data_hora_fim', inicioDia.toISOString())
      .lt('data_hora_inicio', fimDia.toISOString())
      .order('data_hora_inicio', { ascending: true });

    if (error) {
      this.logger.error(
        `Erro ao carregar agenda do dia ${data}: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException('Erro ao carregar a agenda');
    }

    return (agendamentos ?? []) as AgendamentoComServico[];
  }

  async atualizarStatus(
    id: string,
    dto: AtualizarStatusAgendamentoDto,
  ): Promise<AgendamentoRow> {
    const { data, error } = await this.supabase
      .from('agendamentos')
      .update({ status: dto.status as AgendamentoStatus })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Erro ao atualizar status ${id} para ${dto.status}: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException(
        'Erro ao atualizar o status do agendamento',
      );
    }

    if (!data) {
      throw new BadRequestException('Agendamento não encontrado');
    }

    return data;
  }
}