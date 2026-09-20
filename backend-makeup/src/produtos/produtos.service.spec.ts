import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ProdutosService } from './produtos.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';

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

describe('ProdutosService (TDD)', () => {
  let service: ProdutosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdutosService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabaseClient },
      ],
    }).compile();

    service = module.get<ProdutosService>(ProdutosService);
    jest.clearAllMocks();
  });

  describe('listarProdutos', () => {
    it('UT-20: deve somar gasto/pessoas apenas de lotes encerrados (custo por pessoa)', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'compras') {
          return cadeia('select', 'order')({
            data: [
              {
                id: 'c1',
                produto_id: 'p1',
                quantidade: 1,
                valor_total: 100,
                data_compra: '2026-08-01',
                produtos: { nome: 'Base Líquida', categoria: 'Base', unidade: 'UN' },
                encerramentos: { pessoas_atendidas: 10, data_fim: '2026-08-20' },
              },
              {
                id: 'c2',
                produto_id: 'p1',
                quantidade: 1,
                valor_total: 120,
                data_compra: '2026-08-25',
                produtos: { nome: 'Base Líquida', categoria: 'Base', unidade: 'UN' },
                encerramentos: null, // lote em aberto
              },
            ],
            error: null,
          });
        }
        return cadeia('select')({ data: [], error: null });
      });

      const produtos = await service.listarProdutos();

      expect(produtos).toHaveLength(1);
      expect(produtos[0]).toMatchObject({
        nome: 'Base Líquida',
        gastoEncerrado: 100,
        pessoasAtendidas: 10,
        quantidadeEncerrada: 1,
        custoPorPessoa: 10,
        lotesAbertos: 1,
      });
    });
  });

  describe('criarCompra', () => {
    it('UT-21: deve lançar BadRequest para produto inexistente', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'produtos') {
          return cadeia('select', 'eq', 'single')({
            data: null,
            error: { message: 'not found' },
          });
        }
        return cadeia('select')({ data: [], error: null });
      });

      await expect(
        service.criarCompra({
          produtoId: 'p1',
          quantidade: 1,
          valorTotal: 90,
          dataCompra: '2026-08-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-21: deve registrar a compra do lote', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'produtos') {
          return cadeia('select', 'eq', 'single')({
            data: { id: 'p1', nome: 'Batom', categoria: 'Batom', unidade: 'UN' },
            error: null,
          });
        }
        if (table === 'compras') {
          return cadeia('insert', 'select', 'single')({
            data: {
              id: 'c3',
              produto_id: 'p1',
              quantidade: 2,
              valor_total: 80,
              data_compra: '2026-08-05',
              observacao: 'Promoção',
              produtos: { nome: 'Batom', categoria: 'Batom', unidade: 'UN' },
              encerramentos: null,
            },
            error: null,
          });
        }
        return cadeia('select')({ data: [], error: null });
      });

      const compra = await service.criarCompra({
        produtoId: 'p1',
        quantidade: 2,
        valorTotal: 80,
        dataCompra: '2026-08-05',
        observacao: 'Promoção',
      });

      expect(compra.encerrado).toBe(false);
      expect(compra.nome).toBe('Batom');
      expect(compra.valorTotal).toBe(80);
    });
  });

  describe('encerrarCompra', () => {
    it('UT-22: deve calcular pessoas_atendidas automaticamente (CONCLUIDO entre data_compra e data_fim)', async () => {
      let chamadas = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'compras') {
          return cadeia('select', 'eq', 'single')({
            data: {
              id: 'c1',
              data_compra: '2026-08-01',
              quantidade: 1,
              valor_total: 100,
              produtos: { nome: 'Base' },
            },
            error: null,
          });
        }
        if (table === 'encerramentos') {
          chamadas += 1;
          if (chamadas === 1) {
            return cadeia('select', 'eq', 'maybeSingle')({
              data: null,
              error: null,
            });
          }
          return cadeia('insert', 'select', 'single')({
            data: { id: 'e1', pessoas_atendidas: 7, data_fim: '2026-08-20' },
            error: null,
          });
        }
        if (table === 'agendamentos') {
          return cadeia('select', 'eq', 'gte', 'lte')({
            data: [],
            error: null,
            count: 7,
          });
        }
        return cadeia('select')({ data: [], error: null });
      });

      const resultado = await service.encerrarCompra('c1', {
        dataFim: '2026-08-20',
      });

      expect(resultado.encerrado).toBe(true);
      expect(resultado.pessoasAtendidas).toBe(7);
    });

    it('UT-23: deve bloquear encerramento duplicado do mesmo lote', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'compras') {
          return cadeia('select', 'eq', 'single')({
            data: {
              id: 'c1',
              data_compra: '2026-08-01',
              quantidade: 1,
              valor_total: 100,
              produtos: { nome: 'Base' },
            },
            error: null,
          });
        }
        if (table === 'encerramentos') {
          return cadeia('select', 'eq', 'maybeSingle')({
            data: { id: 'e1' },
            error: null,
          });
        }
        return cadeia('select')({ data: [], error: null });
      });

      await expect(
        service.encerrarCompra('c1', { dataFim: '2026-08-20' }),
      ).rejects.toThrow(ConflictException);
    });

    it('UT-23: deve lançar BadRequest para compra inexistente', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'compras') {
          return cadeia('select', 'eq', 'single')({
            data: null,
            error: { message: 'not found' },
          });
        }
        return cadeia('select')({ data: [], error: null });
      });

      await expect(
        service.encerrarCompra('nao-existe', { dataFim: '2026-08-20' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('UT-24: deve validar a contagem com limites baseados na data da compra e fim', async () => {
      let chamadasEncerramentos = 0;
      let cadeiaAgendamentos: Record<string, jest.Mock> | undefined;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'compras') {
          return cadeia('select', 'eq', 'single')({
            data: {
              id: 'c1',
              data_compra: '2026-08-01',
              quantidade: 1,
              valor_total: 100,
              produtos: { nome: 'Base' },
            },
            error: null,
          });
        }
        if (table === 'encerramentos') {
          chamadasEncerramentos += 1;
          if (chamadasEncerramentos === 1) {
            return cadeia('select', 'eq', 'maybeSingle')({ data: null, error: null });
          }
          return cadeia('insert', 'select', 'single')({
            data: { id: 'e1', pessoas_atendidas: 5, data_fim: '2026-08-30' },
            error: null,
          });
        }
        if (table === 'agendamentos') {
          cadeiaAgendamentos = cadeia('select', 'eq', 'gte', 'lte')({
            data: [],
            error: null,
            count: 5,
          });
          return cadeiaAgendamentos;
        }
        return cadeia('select')({ data: [], error: null });
      });

      await service.encerrarCompra('c1', { dataFim: '2026-08-30' });

      const inicio = cadeiaAgendamentos?.gte.mock.calls[0][1] as string;
      const fim = cadeiaAgendamentos?.lte.mock.calls[0][1] as string;

      // 2026-08-01T00:00 e 2026-08-30T23:59 em America/Sao_Paulo = UTC-3
      expect(inicio).toBe('2026-08-01T03:00:00.000Z');
      expect(fim).toBe('2026-08-31T02:59:59.000Z');
    });
  });

  describe('atualizarCompra', () => {
    it('UT-25: deve impedir edição de compra já encerrada', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'encerramentos') {
          return cadeia('select', 'eq', 'maybeSingle')({
            data: { id: 'e1' },
            error: null,
          });
        }
        return cadeia('select')({ data: [], error: null });
      });

      await expect(
        service.atualizarCompra('c1', { valorTotal: 150 }),
      ).rejects.toThrow(ConflictException);
    });
  });
});