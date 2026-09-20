import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { formatInTimeZone } from 'date-fns-tz';
import { FUSO_HORARIO } from '../../horario.config';
import {
  CobrancaCriada,
  CriarCobrancaInput,
  GatewayPagamento,
} from './gateway.interface';

interface AsaasCustomerResponse {
  id: string;
}

interface AsaasPaymentResponse {
  id: string;
  status: string;
}

interface AsaasPixQrResponse {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

/**
 * Adapter do gateway Asaas (Pix dinâmico).
 *
 * Homologação usa a SANDBOX (https://api-sandbox.asaas.com) com ASSAAS_API_KEY.
 * O contrato em GatewayPagamento é o mesmo que o de uma futura implementação
 * Mercado Pago: migrar = criar outro adapter + apontar GATEWAY_PRIMARY.
 */
@Injectable()
export class AsaasGateway implements GatewayPagamento {
  private readonly logger = new Logger(AsaasGateway.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiUrl = (
      process.env.ASSAAS_API_URL ?? 'https://api-sandbox.asaas.com'
    ).replace(/\/$/, '');
    this.apiKey = process.env.ASSAAS_API_KEY ?? '';
  }

  private async requisitar<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'Gateway de pagamento não configurado (ASSAAS_API_KEY ausente)',
      );
    }

    const url = `${this.apiUrl}${path}`;
    this.logger.log(`ASAAS ${method} ${url}`);

    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
          'User-Agent': 'MakeupApp/1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (erro) {
      this.logger.error(
        `Falha de rede no Asaas ${method} ${path}: ${String(erro)}`,
      );
      throw new ServiceUnavailableException(
        'Falha ao comunicar com o gateway de pagamento',
      );
    }

    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => '');
      this.logger.error(
        `Asaas ${method} ${path} respondeu ${resposta.status}: ${texto}`,
      );
      throw new InternalServerErrorException(
        `Falha no gateway: ${resposta.status} ${resposta.statusText}`,
      );
    }

    if (resposta.status === 204) {
      return undefined as T;
    }

    return (await resposta.json()) as T;
  }

  async criaCobranca(input: CriarCobrancaInput): Promise<CobrancaCriada> {
    if (!input.pagador.cpf) {
      throw new InternalServerErrorException(
        'CPF do pagador é obrigatório para o pix dinâmico',
      );
    }

    this.logger.log(
      `criaCobranca: criando customer para ${input.pagador.nome} (cpf=${input.pagador.cpf})`,
    );
    const cliente = await this.requisitar<AsaasCustomerResponse>(
      'POST',
      '/v3/customers',
      {
        name: input.pagador.nome,
        cpfCnpj: input.pagador.cpf,
        email: input.pagador.email,
        mobilePhone: input.pagador.whatsapp,
        notificationDisabled: true,
        externalReference: 'makeupapp',
      },
    );

    this.logger.log(
      `criaCobranca: customer ${cliente.id} criado, criando pagamento PIX de R$${input.valor}`,
    );
    const pagamento = await this.requisitar<AsaasPaymentResponse>(
      'POST',
      '/v3/payments',
      {
        customer: cliente.id,
        billingType: 'PIX',
        value: input.valor,
        dueDate: input.vencimento,
        externalReference: input.idExterno,
        description: `Sinal de agendamento ${input.idExterno}`,
      },
    );

    this.logger.log(
      `criaCobranca: pagamento ${pagamento.id} criado, busando QR code`,
    );
    const qr = await this.requisitar<AsaasPixQrResponse>(
      'GET',
      `/v3/payments/${pagamento.id}/pixQrCode`,
    );

    this.logger.log(
      `Cobrança PIX criada no Asaas: payment=${pagamento.id} valor=${input.valor}`,
    );

    return {
      gatewayPaymentId: pagamento.id,
      gatewayCustomerId: cliente.id,
      qrBase64: qr.encodedImage,
      copiaECola: qr.payload,
      expiraEm: qr.expirationDate,
    };
  }

  async cancelaCobranca(gatewayPaymentId: string): Promise<void> {
    await this.requisitar<never>('DELETE', `/v3/payments/${gatewayPaymentId}`);
    this.logger.log(`Cobrança ${gatewayPaymentId} cancelada no Asaas`);
  }

  static dataVencimentoLocal(offsetDias = 0): string {
    const data = new Date();
    if (offsetDias) {
      data.setDate(data.getDate() + offsetDias);
    }
    return formatInTimeZone(data, FUSO_HORARIO, 'yyyy-MM-dd');
  }
}