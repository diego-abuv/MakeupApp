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
import { CriarBloqueioDto } from './dto/criar-bloqueio.dto';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import { BloqueioRow, Database } from '../types/database';
import {
  FUSO_HORARIO,
  formatarHoraLocal,
  parseDataLocal,
} from '../horario.util';

// Data de referência (2000-01-02 é um domingo) usada para "ancorar" rotinas
// semanais em datas distintas por dia da semana, evitando que o índice de
// exclusão (anti-double-booking) trate regras de dias diferentes como conflito.
const REFERENCIA_SEMANA = Date.UTC(2000, 0, 2);

function dataAncoraRecorrente(diaSemana: number): string {
  return new Date(REFERENCIA_SEMANA + diaSemana * 86400000)
    .toISOString()
    .slice(0, 10);
}

interface Intervalo {
  inicio: Date;
  fim: Date;
}

function colide(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && a.fim > b.inicio;
}

@Injectable()
export class BloqueiosService {
  private readonly logger = new Logger(BloqueiosService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  private diaSemanaDe(dataLocal: string): number {
    const [ano, mes, dia] = dataLocal.slice(0, 10).split('-').map(Number);
    return new Date(ano, mes - 1, dia, 12).getDay();
  }

  async criar(dto: CriarBloqueioDto): Promise<BloqueioRow> {
    const inicio = fromZonedTime(dto.dataHoraInicio, FUSO_HORARIO);
    const fim = fromZonedTime(dto.dataHoraFim, FUSO_HORARIO);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      throw new BadRequestException('Datas do bloqueio inválidas');
    }
    if (fim <= inicio) {
      throw new BadRequestException(
        'O fim do bloqueio deve ser posterior ao início',
      );
    }

    const recorrente = dto.recorrente ?? false;
    const tipo = dto.tipo ?? 'IMPREVISTO';
    const diaSemana = recorrente
      ? (dto.dia_semana ?? this.diaSemanaDe(dto.dataHoraInicio))
      : null;

    // Para regras recorrentes a data real não importa: aplicam-se toda semana.
    // Ancoramos em uma data fixa do dia da semana para que a constraint de
    // sobreposição de intervalos não dê 500 ao criar regras de dias distintos.
    let inicioArmazenado = inicio;
    let fimArmazenado = fim;
    if (recorrente && diaSemana !== null) {
      const ancora = dataAncoraRecorrente(diaSemana);
      inicioArmazenado = parseDataLocal(ancora, formatarHoraLocal(inicio));
      fimArmazenado = parseDataLocal(ancora, formatarHoraLocal(fim));
    }

    // Validação no app (409) antes de tocar o banco — dá mensagem amigável
    // em vez do 500 cru da constraint gist.
    if (recorrente && diaSemana !== null) {
      const conflitantes = await this.buscarRecentesConflitantes(
        diaSemana,
        inicioArmazenado,
        fimArmazenado,
      );
      if (conflitantes.length > 0) {
        this.logger.warn(
          `Conflito ao criar bloqueio recorrente (dia=${diaSemana}, ${formatarHoraLocal(inicio)}-${formatarHoraLocal(fim)}): já existe regra sobreposta.`,
        );
        throw new ConflictException(
          'Já existe um bloqueio neste horário para este dia da semana',
        );
      }
    }

    const { data, error } = await this.supabase
      .from('bloqueios')
      .insert({
        data_hora_inicio: inicioArmazenado.toISOString(),
        data_hora_fim: fimArmazenado.toISOString(),
        motivo: dto.motivo ?? null,
        recorrente,
        dia_semana: recorrente ? diaSemana : null,
        tipo,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Erro ao inserir bloqueio: code=${error.code} message=${error.message} details=${error.details ?? ''} body=${JSON.stringify(dto)}`,
      );
      if (error.code === '23P01') {
        throw new ConflictException(
          'Já existe um bloqueio sobreposto para este período',
        );
      }
      throw new InternalServerErrorException('Erro ao criar o bloqueio');
    }

    this.logger.log(
      `Bloqueio criado: tipo=${tipo} recorrente=${recorrente} dia=${diaSemana ?? '-'} ${formatarHoraLocal(inicio)}-${formatarHoraLocal(fim)}`,
    );

    return data;
  }

  private async buscarRecentesConflitantes(
    diaSemana: number,
    inicio: Date,
    fim: Date,
  ): Promise<Intervalo[]> {
    const { data, error } = await this.supabase
      .from('bloqueios')
      .select('data_hora_inicio, data_hora_fim')
      .eq('recorrente', true)
      .eq('dia_semana', diaSemana);

    if (error) {
      this.logger.error(
        `Erro ao consultar bloqueios recorrentes: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException(
        'Erro ao validar bloqueios recorrentes',
      );
    }

    const novo: Intervalo = { inicio, fim };
    return (data ?? [])
      .map((b) => ({
        inicio: new Date(b.data_hora_inicio),
        fim: new Date(b.data_hora_fim),
      }))
      .filter((b) => colide(novo, b));
  }

  async listar(): Promise<BloqueioRow[]> {
    const { data, error } = await this.supabase
      .from('bloqueios')
      .select('*')
      .order('recorrente', { ascending: false })
      .order('data_hora_inicio');

    if (error) {
      this.logger.error(
        `Erro ao listar bloqueios: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException('Erro ao listar os bloqueios');
    }

    return data ?? [];
  }

  async remover(id: string): Promise<void> {
    const { data: existente, error: existeError } = await this.supabase
      .from('bloqueios')
      .select('id')
      .eq('id', id)
      .single();

    if (existeError || !existente) {
      this.logger.warn(`Tentativa de remover bloqueio inexistente: ${id}`);
      throw new BadRequestException('Bloqueio não encontrado');
    }

    const { error } = await this.supabase
      .from('bloqueios')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(
        `Erro ao remover bloqueio ${id}: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException('Erro ao remover o bloqueio');
    }

    this.logger.log(`Bloqueio removido: ${id}`);
  }

  async listarEntre(inicio: string, fim: string): Promise<BloqueioRow[]> {
    const { data, error } = await this.supabase
      .from('bloqueios')
      .select('*')
      .gte('data_hora_inicio', inicio)
      .lte('data_hora_inicio', fim)
      .order('data_hora_inicio');

    if (error) {
      this.logger.error(
        `Erro ao listar bloqueios entre ${inicio} e ${fim}: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException('Erro ao listar os bloqueios');
    }

    return data ?? [];
  }
}
