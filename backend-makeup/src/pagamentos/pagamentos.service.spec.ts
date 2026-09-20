import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PagamentosService } from './pagamentos.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import { GATEWAY_PAGAMENTO } from './gateway/gateway.interface';
import { AgendamentosService } from '../agendamentos/agendamentos.service';

const mockSupabaseClient = { from: jest.fn() };

function cadeia(
  ...metodos: string[]
): (final?: unknown) => Record<string, jest.Mock> {
  return (final: unknown) => {
    const chain: Record<string, jest.Mock> = {};
    metodos.forEach((m, i) => {
      chain[m] =
        i === metodos.length - 1
          ? jest.fn().mockResolvedValue(final)
          : jest.fn().mockReturnThis();
    });
    return chain;
  };
}

describe('PagamentosService (TDD)', () => {
  let service: PagamentosService;
  let agendamentosService: AgendamentosService;
  const gatewayMock = {
    criaCobranca: jest.fn(),
    cancelaCobranca: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const agendamentosModule = await Test.createTestingModule({
      providers: [
        AgendamentosService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabaseClient },
      ],
    }).compile();
    agendamentosService =
      agendamentosModule.get<AgendamentosService>(AgendamentosService);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagamentosService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabaseClient },
        { provide: GATEWAY_PAGAMENTO, useValue: gatewayMock },
        { provide: AgendamentosService, useValue: agendamentosService },
      ],
    }).compile();

    service = module.get<PagamentosService>(PagamentosService);
  });

function mockBuscarAgendamento(agendamento: unknown) {
  let chamadasAgendamentos = 0;
  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'agendamentos') {
      chamadasAgendamentos += 1;
      if (chamadasAgendamentos === 1) {
        // liberarSinaisExpirados roda antes da busca
        return cadeia('update', 'eq', 'lt', 'select')({
          data: [],
          error: null,
        });
      }
      return cadeia('select', 'eq', 'single')({
        data: agendamento,
        error: null,
      });
    }
    if (table === 'servicos') {
      return cadeia('select', 'eq', 'single')({ data: {}, error: null });
    }
    return cadeia('select')({ data: [], error: null });
  });
}

  describe('gerarPix', () => {
    const agendamentoBase = {
      id: 'agendamento-1',
      cliente_nome: 'Maria Silva',
      cliente_whatsapp: '35999999999',
      cliente_email: 'maria@email.com',
      cliente_cpf: '52998224725',
      sinal_valor: 60,
      pix_expiracao: null,
      pix_qr_base64: null,
      pix_copia_cola: null,
      gateway_payment_id: null,
      status: 'AGUARDANDO_SINAL',
      pagamento_status: 'AGUARDANDO',
      servicos: { preco: 120 },
    };

    it('UT-14: deve criar cobrança no gateway e gravar o QR no agendamento', async () => {
      // liberar sinais (update) + busca (select)
      let chamadasAgend = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'agendamentos') {
          chamadasAgend += 1;
          if (chamadasAgend === 1) {
            return cadeia('update', 'eq', 'lt', 'select')({
              data: [],
              error: null,
            });
          }
          if (chamadasAgend === 2) {
            return cadeia('select', 'eq', 'single')({
              data: agendamentoBase,
              error: null,
            });
          }
          return cadeia('update', 'eq')({ error: null });
        }
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({ data: {}, error: null });
        }
        return cadeia('select')({ data: [], error: null });
      });

      gatewayMock.criaCobranca.mockResolvedValue({
        gatewayPaymentId: 'pay_123',
        gatewayCustomerId: 'cus_123',
        qrBase64: 'data:image/png;base64,AAAA',
        copiaECola: '00020126580014br.gov.bcb.pix',
        expiraEm: '2026-08-10T20:30:00.000Z',
      });

      const resultado = await service.gerarPix('agendamento-1');

      expect(gatewayMock.criaCobranca).toHaveBeenCalledWith(
        expect.objectContaining({
          valor: 60,
          idExterno: 'agendamento-1',
          pagador: {
            nome: 'Maria Silva',
            whatsapp: '35999999999',
            email: 'maria@email.com',
            cpf: '52998224725',
          },
        }),
      );
      expect(resultado.pixQrBase64).toBe('data:image/png;base64,AAAA');
      expect(resultado.pixCopiaCola).toBe('00020126580014br.gov.bcb.pix');
      expect(resultado.sinalValor).toBe(60);
      expect(resultado.total).toBe(120);
    });

    it('UT-14: deve reutilizar pix vigente sem chamar o gateway', async () => {
      mockBuscarAgendamento({
        ...agendamentoBase,
        pix_qr_base64: 'data:image/png;base64,EXISTENTE',
        pix_copia_cola: '0002011',
        pix_expiracao: '2099-01-01T00:00:00.000Z',
      });

      const resultado = await service.gerarPix('agendamento-1');

      expect(gatewayMock.criaCobranca).not.toHaveBeenCalled();
      expect(resultado.pixQrBase64).toBe('data:image/png;base64,EXISTENTE');
    });

    it('UT-14: deve rejeitar se o sinal já foi pago', async () => {
      mockBuscarAgendamento({
        ...agendamentoBase,
        pagamento_status: 'PAGO',
      });

      await expect(service.gerarPix('agendamento-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('UT-14: deve rejeitar se o agendamento não estiver AGUARDANDO_SINAL', async () => {
      mockBuscarAgendamento({
        ...agendamentoBase,
        status: 'CONFIRMADO',
        pagamento_status: 'PAGO',
      });

      await expect(service.gerarPix('agendamento-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('processarWebhook', () => {
    beforeEach(() => {
      process.env.ASSAAS_WEBHOOK_TOKEN = 'token-secreto';
    });

    afterAll(() => {
      delete process.env.ASSAAS_WEBHOOK_TOKEN;
    });

    it('UT-15: deve confirmar o sinal ao receber PAYMENT_CONFIRMED', async () => {
      let chamadas = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'agendamentos') {
          chamadas += 1;
          if (chamadas === 1) {
            return cadeia('select', 'eq', 'single')({
              data: { id: 'agendamento-1', pagamento_status: 'AGUARDANDO' },
              error: null,
            });
          }
          return cadeia('update', 'eq')({ error: null });
        }
        return cadeia('select')({ data: [], error: null });
      });

      const resultado = await service.processarWebhook('token-secreto', {
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay_123' },
      });

      expect(resultado).toEqual({ ok: true, processado: true });
    });

    it('UT-16: deve rejeitar webhook sem token válido', async () => {
      await expect(
        service.processarWebhook('token-errado', {
          event: 'PAYMENT_CONFIRMED',
          payment: { id: 'pay_123' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-16: deve ser idempotente para pagamento já confirmado', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'agendamentos') {
          return cadeia('select', 'eq', 'single')({
            data: { id: 'agendamento-1', pagamento_status: 'PAGO' },
            error: null,
          });
        }
        return cadeia('select')({ data: [], error: null });
      });

      const resultado = await service.processarWebhook('token-secreto', {
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay_123' },
      });

      expect(resultado).toEqual({ ok: true, processado: false });
    });

    it('UT-16: não deve processar eventos fora da confirmação', async () => {
      const resultado = await service.processarWebhook('token-secreto', {
        event: 'PAYMENT_CREATED',
        payment: { id: 'pay_123' },
      });

      expect(resultado).toEqual({ ok: true, processado: false });
    });
  });

  describe('cancelarSinal', () => {
    it('UT-17: deve cancelar a cobrança no gateway e marcar CANCELADO', async () => {
      let chamadas = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'agendamentos') {
          chamadas += 1;
          if (chamadas === 1) {
            return cadeia('update', 'eq', 'lt', 'select')({
              data: [],
              error: null,
            });
          }
          if (chamadas === 2) {
            return cadeia('select', 'eq', 'single')({
              data: {
                id: 'agendamento-1',
                status: 'AGUARDANDO_SINAL',
                pagamento_status: 'AGUARDANDO',
                gateway_payment_id: 'pay_999',
              },
              error: null,
            });
          }
          return cadeia('update', 'eq')({ error: null });
        }
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({ data: {}, error: null });
        }
        return cadeia('select')({ data: [], error: null });
      });

      const resultado = await service.cancelarSinal('agendamento-1');

      expect(gatewayMock.cancelaCobranca).toHaveBeenCalledWith('pay_999');
      expect(resultado).toEqual({ id: 'agendamento-1' });
    });

    it('UT-17: deve recusar cancelamento quando o sinal já foi pago', async () => {
      mockBuscarAgendamento({
        id: 'agendamento-1',
        status: 'CONFIRMADO',
        pagamento_status: 'PAGO',
      });

      await expect(service.cancelarSinal('agendamento-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('obterStatusSinal', () => {
    it('UT-18: deve retornar o status do sinal para o polling do cliente', async () => {
      mockBuscarAgendamento({
        id: 'agendamento-1',
        status: 'CONFIRMADO',
        pagamento_status: 'PAGO',
        servicos: { preco: 120 },
      });

      const resultado = await service.obterStatusSinal('agendamento-1');

      expect(resultado).toEqual({
        status: 'CONFIRMADO',
        pagamentoStatus: 'PAGO',
      });
    });

    it('UT-18: deve reportar AGUARDANDO quando o sinal ainda está pendente', async () => {
      mockBuscarAgendamento({
        id: 'agendamento-1',
        status: 'AGUARDANDO_SINAL',
        pagamento_status: 'AGUARDANDO',
        servicos: { preco: 120 },
      });

      const resultado = await service.obterStatusSinal('agendamento-1');

      expect(resultado).toEqual({
        status: 'AGUARDANDO_SINAL',
        pagamentoStatus: 'AGUARDANDO',
      });
    });
  });
});