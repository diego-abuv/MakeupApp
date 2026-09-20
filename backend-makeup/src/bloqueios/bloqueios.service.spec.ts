import { Test, TestingModule } from '@nestjs/testing';
import { BloqueiosService } from './bloqueios.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';

const mockSupabaseClient = {
  from: jest.fn(),
};

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

describe('BloqueiosService', () => {
  let service: BloqueiosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloqueiosService,
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabaseClient,
        },
      ],
    }).compile();

    service = module.get<BloqueiosService>(BloqueiosService);
    jest.clearAllMocks();
  });

  describe('criar', () => {
    it('deve criar um bloqueio pontual (IMPREVISTO)', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'bloqueios') {
          return cadeia(
            'insert',
            'select',
            'single',
          )({
            data: { id: 'b1' },
            error: null,
          });
        }
      });

      const result = await service.criar({
        dataHoraInicio: '2026-08-10T12:00',
        dataHoraFim: '2026-08-10T13:00',
        motivo: 'Dentista',
        tipo: 'IMPREVISTO',
      });

      expect(result).toEqual({ id: 'b1' });
    });

    it('UT-B1: deve rejeitar fim anterior ao início', async () => {
      await expect(
        service.criar({
          dataHoraInicio: '2026-08-10T14:00',
          dataHoraFim: '2026-08-10T13:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-B2: não deve conflitar regras recorrentes de dias distintos (Almoço Segunda e Terça)', async () => {
      const insercoes: unknown[] = [];
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'bloqueios') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            insert: jest.fn().mockImplementation((payload) => {
              insercoes.push(payload);
              return {
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: `b${insercoes.length}` },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
      });

      await service.criar({
        dataHoraInicio: '2026-08-03T12:00', // segunda
        dataHoraFim: '2026-08-03T13:00',
        recorrente: true,
        dia_semana: 1,
        tipo: 'ALMOCO',
      });
      await service.criar({
        dataHoraInicio: '2026-08-04T12:00', // terça
        dataHoraFim: '2026-08-04T13:00',
        recorrente: true,
        dia_semana: 2,
        tipo: 'ALMOCO',
      });

      expect(insercoes).toHaveLength(2);
      // As âncoras devem ser datas distintas (domingo=2000-01-02, segunda=03, terça=04...)
      const primeira = insercoes[0] as Record<string, string>;
      const segunda = insercoes[1] as Record<string, string>;
      expect(primeira.data_hora_inicio).not.toBe(segunda.data_hora_inicio);
      expect(primeira.dia_semana).toBe(1);
      expect(segunda.dia_semana).toBe(2);
    });

    it('UT-B3: deve lançar ConflictException ao repetir regra recorrente no mesmo dia e horário', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'bloqueios') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [
                    {
                      // âncora de segunda 12:00 SP (jan/2000 estava em horário
                      // de verão, -02:00 -> 14:00Z)
                      data_hora_inicio: '2000-01-03T14:00:00.000Z',
                      data_hora_fim: '2000-01-03T15:00:00.000Z', // 13:00 SP
                    },
                  ],
                  error: null,
                }),
              }),
            }),
            insert: jest.fn(),
          };
        }
      });

      await expect(
        service.criar({
          dataHoraInicio: '2026-08-03T12:00',
          dataHoraFim: '2026-08-03T13:00',
          recorrente: true,
          dia_semana: 1,
          tipo: 'ALMOCO',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('UT-B4: deve transformar a violação de exclusão do banco em ConflictException', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'bloqueios') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: '23P01', message: 'conflicting key value' },
                }),
              }),
            }),
          };
        }
      });

      await expect(
        service.criar({
          dataHoraInicio: '2026-08-10T10:00',
          dataHoraFim: '2026-08-10T11:00',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
