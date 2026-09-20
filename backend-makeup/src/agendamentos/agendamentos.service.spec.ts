import { Test, TestingModule } from '@nestjs/testing';
import { AgendamentosService } from './agendamentos.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';

const mockSupabaseClient = {
  from: jest.fn(),
};

// Helper para montar cadeias de query encadeadas do Supabase.
// O último método resolve o valor final; os anteriores retornam `this`.
function cadeia(
  ...metodos: string[]
): (final?: unknown) => Record<string, jest.Mock> {
  return (final: unknown) => {
    const chain: Record<string, jest.Mock> = {};
    metodos.forEach((m, i) => {
      if (i === metodos.length - 1) {
        chain[m] = jest.fn().mockResolvedValue(final);
      } else {
        chain[m] = jest.fn().mockReturnThis();
      }
    });
    return chain;
  };
}

const SERVICO_ATIVO = { preco: 100, duracao_minutos: 30, ativo: true };

describe('AgendamentosService (TDD)', () => {
  let service: AgendamentosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgendamentosService,
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabaseClient,
        },
      ],
    }).compile();

    service = module.get<AgendamentosService>(AgendamentosService);
    jest.clearAllMocks();
  });

  describe('obterHorariosDisponiveis', () => {
    it('UT-01: deve gerar grade completa de slots quando não houver agendamentos', async () => {
      let chamadasBloqueios = 0;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return cadeia(
            'select',
            'eq',
            'single',
          )({ data: SERVICO_ATIVO, error: null });
        }
        if (table === 'agendamentos') {
          return cadeia(
            'select',
            'in',
            'gt',
            'lt',
          )({ data: [], error: null });
        }
        if (table === 'bloqueios') {
          chamadasBloqueios += 1;
          if (chamadasBloqueios === 1) {
            return cadeia(
              'select',
              'gt',
              'lt',
            )({ data: [], error: null });
          }
          return cadeia(
            'select',
            'eq',
            'eq',
          )({ data: [], error: null });
        }
        if (table === 'config_agenda') {
          return cadeia('select', 'eq', 'maybeSingle')({
            data: { hora_inicio: '08:00', hora_fim: '20:00' },
            error: null,
          });
        }
      });

      const slots = await service.obterHorariosDisponiveis(
        'servico-uuid-1',
        '2026-08-10',
      );

      const horarios = slots.map((s) => s.hora);
      expect(horarios).toContain('09:00');
      expect(horarios).toContain('09:30');
      expect(horarios).toContain('10:00');
      expect(horarios).toContain('19:30');
      expect(slots.every((s) => s.disponivel)).toBe(true);
    });

    it('UT-02 & UT-03: deve ocultar horários que conflitam com agendamentos existentes', async () => {
      let chamadasBloqueios = 0;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({
            data: { preco: 200, duracao_minutos: 60, ativo: true }, // 1h
            error: null,
          });
        }
        if (table === 'agendamentos') {
          // 10:00-10:30 em America/Sao_Paulo = 13:00Z-13:30Z
          return cadeia(
            'select',
            'in',
            'gt',
            'lt',
          )({
            data: [
              {
                data_hora_inicio: '2026-08-10T13:00:00.000Z',
                data_hora_fim: '2026-08-10T13:30:00.000Z',
              },
            ],
            error: null,
          });
        }
        if (table === 'bloqueios') {
          chamadasBloqueios += 1;
          if (chamadasBloqueios === 1) {
            return cadeia('select', 'gt', 'lt')({ data: [], error: null });
          }
          return cadeia('select', 'eq', 'eq')({ data: [], error: null });
        }
        if (table === 'config_agenda') {
          return cadeia('select', 'eq', 'maybeSingle')({
            data: { hora_inicio: '08:00', hora_fim: '20:00' },
            error: null,
          });
        }
      });

      const slots = await service.obterHorariosDisponiveis(
        'servico-uuid-combo',
        '2026-08-10',
      );

      const porHora = (h: string) => slots.find((s) => s.hora === h);
      expect(porHora('09:30')?.disponivel).toBe(false);
      expect(porHora('10:00')?.disponivel).toBe(false);
      expect(porHora('08:30')?.disponivel).toBe(true);
      expect(porHora('10:30')?.disponivel).toBe(true);
    });

    it('UT-04: deve remover slots que colidem com bloqueios manuais (almoço)', async () => {
      let chamadasBloqueios = 0;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({ data: SERVICO_ATIVO, error: null });
        }
        if (table === 'agendamentos') {
          return cadeia('select', 'in', 'gt', 'lt')({ data: [], error: null });
        }
        if (table === 'bloqueios') {
          chamadasBloqueios += 1;
          if (chamadasBloqueios === 1) {
            // 12:00-13:00 em America/Sao_Paulo = 15:00Z-16:00Z
            return cadeia('select', 'gt', 'lt')({
              data: [
                {
                  data_hora_inicio: '2026-08-10T15:00:00.000Z',
                  data_hora_fim: '2026-08-10T16:00:00.000Z',
                },
              ],
              error: null,
            });
          }
          return cadeia('select', 'eq', 'eq')({ data: [], error: null });
        }
        if (table === 'config_agenda') {
          return cadeia('select', 'eq', 'maybeSingle')({
            data: { hora_inicio: '08:00', hora_fim: '20:00' },
            error: null,
          });
        }
      });

      const slots = await service.obterHorariosDisponiveis(
        'servico-uuid-1',
        '2026-08-10',
      );

      expect(slots.find((s) => s.hora === '12:00')?.disponivel).toBe(false);
      expect(slots.find((s) => s.hora === '12:30')?.disponivel).toBe(false);
      expect(slots.find((s) => s.hora === '11:30')?.disponivel).toBe(true);
    });

    it('UT-07: deve lançar BadRequestException para serviço inativo', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({
            data: { preco: 120, duracao_minutos: 30, ativo: false },
            error: null,
          });
        }
      });

      await expect(
        service.obterHorariosDisponiveis('servico-uuid-1', '2026-08-10'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('criarAgendamento', () => {
    const baseDto = {
      clienteNome: 'João Silva',
      clienteWhatsapp: '35999999999',
      clienteEmail: 'Joao.Silva@Exemplo.com',
      clienteCpf: '529.982.247-25',
      servicoId: 'servico-uuid-1',
      dataHoraInicio: '2026-08-10T14:00',
    };

    function mockCriarFluxoLivres(criado: unknown) {
      let chamadasAgendamentos = 0;
      let chamadasBloqueios = 0;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({
            data: SERVICO_ATIVO,
            error: null,
          });
        }
        if (table === 'agendamentos') {
          chamadasAgendamentos += 1;
          if (chamadasAgendamentos === 1) {
            // liberarSinaisExpirados
            return cadeia('update', 'eq', 'lt', 'select')({ data: [], error: null });
          }
          if (chamadasAgendamentos === 2) {
            // conflitos (anti double-booking)
            return cadeia('select', 'neq', 'neq', 'lt', 'gt')({
              data: [],
              error: null,
            });
          }
          // insert
          return cadeia('insert', 'select', 'single')({ data: criado, error: null });
        }
        if (table === 'bloqueios') {
          chamadasBloqueios += 1;
          if (chamadasBloqueios === 1) {
            return cadeia('select', 'lt', 'gt')({ data: [], error: null });
          }
          return cadeia('select', 'eq', 'eq')({ data: [], error: null });
        }
        if (table === 'config_agenda') {
          return cadeia('select', 'eq', 'maybeSingle')({
            data: { hora_inicio: '08:00', hora_fim: '20:00' },
            error: null,
          });
        }
      });
    }

    it('UT-10: deve criar em AGUARDANDO_SINAL com sinal de 50% e expiração', async () => {
      const criado = {
        id: 'agendamento-novo',
        status: 'AGUARDANDO_SINAL',
        sinal_valor: 50,
        sinal_expiracao: '2026-08-10T17:15:00.000Z',
        pagamento_status: 'AGUARDANDO',
        cliente_cpf: '52998224725',
        cliente_email: 'joao.silva@exemplo.com',
      };
      mockCriarFluxoLivres(criado);

      const resultado = await service.criarAgendamento({ ...baseDto });

      expect(resultado.status).toBe('AGUARDANDO_SINAL');
      expect(resultado.sinal_valor).toBe(50);
      expect(resultado.sinal_expiracao).toBe('2026-08-10T17:15:00.000Z');
      expect(resultado.pagamento_status).toBe('AGUARDANDO');
      expect(resultado.cliente_cpf).toBe('52998224725');
      expect(resultado.cliente_email).toBe('joao.silva@exemplo.com');
    });

    it('UT-10: deve enviar sinal de 50% e expiração de ~15min no insert', async () => {
      const cadeiasAgendamento: Record<string, jest.Mock>[] = [];
      let chamadasBloqueio = 0;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({
            data: SERVICO_ATIVO,
            error: null,
          });
        }
        if (table === 'agendamentos') {
          const agCount = cadeiasAgendamento.length;
          const chain =
            agCount === 0
              ? cadeia('update', 'eq', 'lt', 'select')({ data: [], error: null })
              : agCount === 1
                ? cadeia('select', 'neq', 'neq', 'lt', 'gt')({ data: [], error: null })
                : cadeia('insert', 'select', 'single')({
                    data: { id: 'agendamento-novo', status: 'AGUARDANDO_SINAL' },
                    error: null,
                  });
          cadeiasAgendamento.push(chain);
          return chain;
        }
        if (table === 'bloqueios') {
          chamadasBloqueio += 1;
          if (chamadasBloqueio === 1) {
            return cadeia('select', 'lt', 'gt')({ data: [], error: null });
          }
          return cadeia('select', 'eq', 'eq')({ data: [], error: null });
        }
        if (table === 'config_agenda') {
          return cadeia('select', 'eq', 'maybeSingle')({
            data: { hora_inicio: '08:00', hora_fim: '20:00' },
            error: null,
          });
        }
      });

      await service.criarAgendamento({ ...baseDto });

      const insertChain = cadeiasAgendamento[2];
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'AGUARDANDO_SINAL',
          pagamento_status: 'AGUARDANDO',
          sinal_valor: 50,
          sinal_expiracao: expect.any(String),
          cliente_cpf: '52998224725',
          cliente_email: 'joao.silva@exemplo.com',
        }),
      );
      const payload = insertChain.insert.mock.calls[0][0] as {
        sinal_expiracao: string;
      };
      const agora = Date.now();
      const expira = new Date(payload.sinal_expiracao).getTime();
      expect(expira - agora).toBeGreaterThan(14.5 * 60 * 1000);
      expect(expira - agora).toBeLessThan(15.5 * 60 * 1000);
    });

    it('UT-11: deve expirar sinais antigos antes de criar (libera slot)', async () => {
      let cadeiaUpdate: Record<string, jest.Mock> | undefined;
      let chamadasAgendamento = 0;
      let chamadasBloqueio = 0;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({
            data: SERVICO_ATIVO,
            error: null,
          });
        }
        if (table === 'agendamentos') {
          chamadasAgendamento += 1;
          if (chamadasAgendamento === 1) {
            cadeiaUpdate = cadeia('update', 'eq', 'lt', 'select')({
              data: [],
              error: null,
            });
            return cadeiaUpdate;
          }
          if (chamadasAgendamento === 2) {
            return cadeia('select', 'neq', 'neq', 'lt', 'gt')({
              data: [],
              error: null,
            });
          }
          return cadeia('insert', 'select', 'single')({
            data: { id: 'agendamento-novo', status: 'AGUARDANDO_SINAL' },
            error: null,
          });
        }
        if (table === 'bloqueios') {
          chamadasBloqueio += 1;
          if (chamadasBloqueio === 1) {
            return cadeia('select', 'lt', 'gt')({ data: [], error: null });
          }
          return cadeia('select', 'eq', 'eq')({ data: [], error: null });
        }
        if (table === 'config_agenda') {
          return cadeia('select', 'eq', 'maybeSingle')({
            data: { hora_inicio: '08:00', hora_fim: '20:00' },
            error: null,
          });
        }
      });

      await service.criarAgendamento({ ...baseDto });

      expect(cadeiaUpdate?.update).toHaveBeenCalledWith({
        status: 'EXPIRADO',
        pagamento_status: 'EXPIRADO',
      });
      expect(cadeiaUpdate?.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'EXPIRADO' }),
      );
    });

    it('UT-12: deve rejeitar CPF com dígito verificador inválido', async () => {
      mockCriarFluxoLivres({ id: 'nao-criado' });

      await expect(
        service.criarAgendamento({ ...baseDto, clienteCpf: '12345678901' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-05: deve lançar ConflictException se houver colisão de horário no momento da criação', async () => {
      let chamadasAgendamentos = 0;
      let chamadasBloqueios = 0;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({
            data: SERVICO_ATIVO,
            error: null,
          });
        }
        if (table === 'agendamentos') {
          chamadasAgendamentos += 1;
          if (chamadasAgendamentos === 1) {
            return cadeia('update', 'eq', 'lt', 'select')({ data: [], error: null });
          }
          // conflito detectado
          return cadeia('select', 'neq', 'neq', 'lt', 'gt')({
            data: [{ id: 'agendamento-existente-id' }],
            error: null,
          });
        }
        if (table === 'bloqueios') {
          chamadasBloqueios += 1;
          if (chamadasBloqueios === 1) {
            return cadeia('select', 'lt', 'gt')({ data: [], error: null });
          }
          return cadeia('select', 'eq', 'eq')({ data: [], error: null });
        }
        if (table === 'config_agenda') {
          return cadeia('select', 'eq', 'maybeSingle')({
            data: { hora_inicio: '08:00', hora_fim: '20:00' },
            error: null,
          });
        }
      });

      await expect(service.criarAgendamento({ ...baseDto })).rejects.toThrow(
        ConflictException,
      );
    });

    it('UT-08: deve lançar ConflictException se houver bloqueio no período', async () => {
      let chamadasAgendamentos = 0;
      let chamadasBloqueios = 0;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({
            data: SERVICO_ATIVO,
            error: null,
          });
        }
        if (table === 'agendamentos') {
          chamadasAgendamentos += 1;
          if (chamadasAgendamentos === 1) {
            return cadeia('update', 'eq', 'lt', 'select')({ data: [], error: null });
          }
          return cadeia('select', 'neq', 'neq', 'lt', 'gt')({
            data: [],
            error: null,
          });
        }
        if (table === 'bloqueios') {
          chamadasBloqueios += 1;
          if (chamadasBloqueios === 1) {
            return cadeia('select', 'lt', 'gt')({
              data: [{ id: 'bloqueio-existente-id' }],
              error: null,
            });
          }
          return cadeia('select', 'eq', 'eq')({ data: [], error: null });
        }
        if (table === 'config_agenda') {
          return cadeia('select', 'eq', 'maybeSingle')({
            data: { hora_inicio: '08:00', hora_fim: '20:00' },
            error: null,
          });
        }
      });

      await expect(service.criarAgendamento({ ...baseDto })).rejects.toThrow(
        ConflictException,
      );
    });

    it('UT-06: deve lançar BadRequestException se o serviço não for encontrado', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return cadeia('select', 'eq', 'single')({
            data: null,
            error: { message: 'not found' },
          });
        }
      });

      await expect(service.criarAgendamento({ ...baseDto })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('UT-09: deve lançar BadRequestException se o horário estiver fora do expediente', async () => {
      mockCriarFluxoLivres({ id: 'nunca-criado' });

      await expect(
        service.criarAgendamento({ ...baseDto, dataHoraInicio: '2026-08-10T07:00' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('liberarSinaisExpirados', () => {
    it('UT-13: deve transicionar AGUARDANDO_SINAL vencido para EXPIRADO', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'agendamentos') {
          return cadeia('update', 'eq', 'lt', 'select')({
            data: [{ id: 'vencido-1' }, { id: 'vencido-2' }],
            error: null,
          });
        }
        return cadeia('select')({ data: [], error: null });
      });

      const quantidade = await service.liberarSinaisExpirados();
      expect(quantidade).toBe(2);
    });
  });

  describe('listarAgendaDoDia', () => {
    it('RF06: deve retornar os agendamentos do dia em ordem cronológica com serviço', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'agendamentos') {
          return cadeia(
            'select',
            'gt',
            'lt',
            'order',
          )({
            data: [
              {
                id: 'a1',
                cliente_nome: 'João Silva',
                data_hora_inicio: '2026-08-10T14:00:00.000Z',
                servicos: { nome: 'Make Social' },
              },
            ],
            error: null,
          });
        }
      });

      const agenda = await service.listarAgendaDoDia('2026-08-10');

      expect(agenda).toHaveLength(1);
      expect(agenda[0].cliente_nome).toBe('João Silva');
    });
  });

  describe('atualizarStatus', () => {
    it('RF07: deve atualizar o status para CONCLUIDO', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'agendamentos') {
          return cadeia(
            'update',
            'eq',
            'select',
            'single',
          )({
            data: { id: 'a1', status: 'CONCLUIDO' },
            error: null,
          });
        }
      });

      const result = await service.atualizarStatus('a1', {
        status: 'CONCLUIDO',
      });

      expect(result.status).toBe('CONCLUIDO');
    });

    it('RF07: deve lançar BadRequestException se o agendamento não existir', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'agendamentos') {
          return cadeia(
            'update',
            'eq',
            'select',
            'single',
          )({
            data: null,
            error: null,
          });
        }
      });

      await expect(
        service.atualizarStatus('a1', { status: 'CANCELADO' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});