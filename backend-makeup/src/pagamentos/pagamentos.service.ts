import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { formatInTimeZone } from 'date-fns-tz';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import { FUSO_HORARIO } from '../horario.config';
import {
  AgendamentoComServico,
  Database,
} from '../types/database';
import {
  CobrancaCriada,
  CriarCobrancaInput,
  GATEWAY_PAGAMENTO,
} from './gateway/gateway.interface';
import type { GatewayPagamento } from './gateway/gateway.interface';
import { AgendamentosService } from '../agendamentos/agendamentos.service';

export interface PixSinal {
  agendamentoId: string;
  sinalValor: number;
  total: number;
  pixQrBase64: string;
  pixCopiaCola: string;
  pixExpiracao: string | null;
}

export interface WebhookProcessado {
  ok: boolean;
  processado: boolean;
}

@Injectable()
export class PagamentosService {
  private readonly logger = new Logger(PagamentosService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
    @Inject(GATEWAY_PAGAMENTO)
    private readonly gateway: GatewayPagamento,
    private readonly agendamentosService: AgendamentosService,
  ) {}

  private async buscarAgendamento(
    agendamentoId: string,
  ): Promise<AgendamentoComServico> {
    const { data, error } = await this.supabase
      .from('agendamentos')
      .select('*, servicos(nome, preco)')
      .eq('id', agendamentoId)
      .single();

    if (error || !data) {
      throw new BadRequestException('Agendamento não encontrado');
    }
    return data as AgendamentoComServico;
  }

  private async gravarPix(
    agendamentoId: string,
    cobranca: CobrancaCriada,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('agendamentos')
      .update({
        gateway_payment_id: cobranca.gatewayPaymentId,
        gateway_customer_id: cobranca.gatewayCustomerId,
        pix_qr_base64: cobranca.qrBase64,
        pix_copia_cola: cobranca.copiaECola,
        pix_expiracao: cobranca.expiraEm,
      })
      .eq('id', agendamentoId)
      .is('pix_qr_base64', null)
      .select('id');

    if (error) {
      this.logger.error(
        `Erro ao gravar pix do agendamento ${agendamentoId}: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException(
        'Erro ao salvar a cobrança do sinal',
      );
    }

    return (data?.length ?? 0) > 0;
  }

  private montarResposta(
    agendamento: AgendamentoComServico,
  ): PixSinal {
    return {
      agendamentoId: agendamento.id,
      sinalValor: Number(agendamento.sinal_valor ?? 0),
      total: Number(agendamento.servicos?.preco ?? 0),
      pixQrBase64: agendamento.pix_qr_base64 ?? '',
      pixCopiaCola: agendamento.pix_copia_cola ?? '',
      pixExpiracao: agendamento.pix_expiracao ?? null,
    };
  }

  async gerarPix(agendamentoId: string): Promise<PixSinal> {
    await this.agendamentosService.liberarSinaisExpirados();

    const agendamento = await this.buscarAgendamento(agendamentoId);

    if (agendamento.pagamento_status === 'PAGO') {
      throw new BadRequestException('Sinal já confirmado');
    }
    if (agendamento.status !== 'AGUARDANDO_SINAL') {
      throw new BadRequestException(
        'Agendamento não está com sinal pendente de pagamento',
      );
    }

    const pixVigente =
      agendamento.pix_qr_base64 &&
      agendamento.pix_expiracao &&
      new Date(agendamento.pix_expiracao).getTime() > Date.now();

    if (pixVigente) {
      return this.montarResposta(agendamento);
    }

    // CLAIM: tenta marcar como "criando" — só succeed se ninguém mais marcou
    const { data: claimed } = await this.supabase
      .from('agendamentos')
      .update({ gateway_payment_id: 'creating' })
      .eq('id', agendamentoId)
      .is('gateway_payment_id', null)
      .select('id');

    if (!claimed || claimed.length === 0) {
      const atual = await this.buscarAgendamento(agendamentoId);
      if (atual.gateway_payment_id === 'creating') {
        throw new BadRequestException(
          'Pagamento já está sendo processado. Aguarde alguns segundos.',
        );
      } else if (atual.pix_qr_base64 && atual.pix_expiracao && new Date(atual.pix_expiracao).getTime() > Date.now()) {
        return this.montarResposta(atual);
      } else {
        throw new BadRequestException(
          'Não foi possível iniciar o pagamento. Tente novamente.',
        );
      }
    }

    const input: CriarCobrancaInput = {
      valor: Number(agendamento.sinal_valor ?? 0),
      vencimento: formatInTimeZone(new Date(), FUSO_HORARIO, 'yyyy-MM-dd'),
      idExterno: agendamento.id,
      pagador: {
        nome: agendamento.cliente_nome,
        whatsapp: agendamento.cliente_whatsapp,
        email: agendamento.cliente_email ?? '',
        cpf: agendamento.cliente_cpf ?? '',
      },
    };

    let cobranca: CobrancaCriada;
    try {
      cobranca = await this.gateway.criaCobranca(input);
    } catch (erro) {
      this.logger.error(
        `Falha ao criar cobrança no ASAAS para ${agendamentoId}: ${String(erro)}`,
      );
      await this.supabase
        .from('agendamentos')
        .update({ gateway_payment_id: null })
        .eq('id', agendamentoId)
        .eq('gateway_payment_id', 'creating');
      throw erro;
    }

    const salvou = await this.gravarPix(agendamento.id, cobranca);

    if (!salvou) {
      this.logger.warn(
        `Concorrência em gerarPix(${agendamentoId}): cobrança ${cobranca.gatewayPaymentId} descartada`,
      );
      const refreshed = await this.buscarAgendamento(agendamentoId);
      return this.montarResposta(refreshed);
    }

    return this.montarResposta({
      ...agendamento,
      pix_qr_base64: cobranca.qrBase64,
      pix_copia_cola: cobranca.copiaECola,
      pix_expiracao: cobranca.expiraEm,
    });
  }

  async obterPix(agendamentoId: string): Promise<PixSinal> {
    await this.agendamentosService.liberarSinaisExpirados();
    const agendamento = await this.buscarAgendamento(agendamentoId);

    const pixAtivo =
      agendamento.pix_qr_base64 &&
      agendamento.pix_expiracao &&
      new Date(agendamento.pix_expiracao).getTime() > Date.now();

    if (!pixAtivo) {
      throw new BadRequestException('Pix não encontrado ou expirado');
    }
    return this.montarResposta(agendamento);
  }

  async obterStatusSinal(agendamentoId: string): Promise<{
    status: string;
    pagamentoStatus: string;
  }> {
    await this.agendamentosService.liberarSinaisExpirados();
    const agendamento = await this.buscarAgendamento(agendamentoId);
    return {
      status: agendamento.status ?? '',
      pagamentoStatus: agendamento.pagamento_status ?? 'AGUARDANDO',
    };
  }

  async processarWebhook(
    tokenRecebido: string,
    payload: { event?: string; payment?: { id?: string } },
  ): Promise<WebhookProcessado> {
    const tokenEsperado = (process.env.ASSAAS_WEBHOOK_TOKEN ?? '').trim();
    if (!tokenEsperado) {
      this.logger.error('ASSAAS_WEBHOOK_TOKEN não configurado');
      throw new InternalServerErrorException(
        'Webhook não configurado no servidor',
      );
    }

    const token = (tokenRecebido ?? '').trim();
    if (!token) {
      throw new BadRequestException('Token de webhook ausente');
    }
    if (token !== tokenEsperado) {
      throw new BadRequestException('Token de webhook inválido');
    }

    const evento = payload?.event;
    const paymentId = payload?.payment?.id;

    const eventosConfirmacao = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
    if (!evento || !eventosConfirmacao.includes(evento) || !paymentId) {
      return { ok: true, processado: false };
    }

    const { data: agendamento, error } = await this.supabase
      .from('agendamentos')
      .select('id, pagamento_status')
      .eq('gateway_payment_id', paymentId)
      .single();

    if (error || !agendamento) {
      this.logger.warn(
        `Webhook ${evento} sem agendamento para payment=${paymentId}`,
      );
      return { ok: true, processado: false };
    }

    if (agendamento.pagamento_status === 'PAGO') {
      return { ok: true, processado: false };
    }

    const { error: atualizacaoError } = await this.supabase
      .from('agendamentos')
      .update({
        status: 'CONFIRMADO',
        pagamento_status: 'PAGO',
        sinal_expiracao: null,
      })
      .eq('id', agendamento.id);

    if (atualizacaoError) {
      throw new InternalServerErrorException(
        'Erro ao confirmar o pagamento do sinal',
      );
    }

    this.logger.log(
      `Sinal confirmado para agendamento ${agendamento.id} (payment=${paymentId})`,
    );

    return { ok: true, processado: true };
  }

  async cancelarSinal(agendamentoId: string): Promise<{ id: string }> {
    await this.agendamentosService.liberarSinaisExpirados();
    const agendamento = await this.buscarAgendamento(agendamentoId);

    if (agendamento.pagamento_status === 'PAGO') {
      throw new BadRequestException(
        'Sinal já pago: cancele o atendimento na agenda',
      );
    }
    if (agendamento.status !== 'AGUARDANDO_SINAL') {
      throw new BadRequestException('Agendamento sem sinal pendente');
    }

    if (agendamento.gateway_payment_id) {
      try {
        await this.gateway.cancelaCobranca(agendamento.gateway_payment_id);
      } catch (erro) {
        this.logger.warn(
          `Falha ao cancelar cobrança ${agendamento.gateway_payment_id}: ${String(erro)} — seguindo com cancelamento local`,
        );
      }
    }

    const { error } = await this.supabase
      .from('agendamentos')
      .update({
        status: 'CANCELADO',
        pagamento_status: 'CANCELADO',
      })
      .eq('id', agendamento.id);

    if (error) {
      throw new InternalServerErrorException(
        'Erro ao cancelar o sinal do agendamento',
      );
    }

    this.logger.log(`Sinal cancelado para agendamento ${agendamento.id}`);
    return { id: agendamento.id };
  }
}