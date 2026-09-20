import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import { ProdutosService } from '../produtos/produtos.service';

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

describe('DashboardService (TDD)', () => {
  let service: DashboardService;
  const produtosServiceMock = {
    listarProdutos: jest.fn(),
    listarCompras: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabaseClient },
        { provide: ProdutosService, useValue: produtosServiceMock },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  function mocksBases() {
    let chamadasCompras = 0;
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'compras') {
        chamadasCompras += 1;
        if (chamadasCompras === 1) {
          return cadeia('select', 'gte', 'lte')({
            data: [
              { valor_total: 100, data_compra: '2026-08-05' },
              { valor_total: 50, data_compra: '2026-09-10' },
            ],
            error: null,
          });
        }
        // segunda chamada = listarCompras (estoque)
        return cadeia('select', 'order')({
          data: [
            {
              id: 'c1', produto_id: 'p1', quantidade: 1, valor_total: 50,
              data_compra: '2026-09-10', observacao: null,
              produtos: { nome: 'Base', categoria: null, unidade: null },
              encerramentos: null,
            },
          ],
          error: null,
        });
      }
      if (table === 'encerramentos') {
        return cadeia('select', 'gte', 'lte')({
          data: [
            { id: 'e1', data_fim: '2026-08-25', compras: { valor_total: 100 } },
          ],
          error: null,
        });
      }
      if (table === 'gastos') {
        return cadeia('select', 'gte', 'lte')({
          data: [{ valor: 30, data: '2026-08-02' }],
          error: null,
        });
      }
      if (table === 'agendamentos') {
        return cadeia('select', 'eq', 'gte', 'lte')({
          data: [
            { data_hora_inicio: '2026-08-10T14:00:00.000Z' },
            { data_hora_inicio: '2026-08-15T14:00:00.000Z' },
          ],
          error: null,
        });
      }
      return cadeia('select')({ data: [], error: null });
    });

    produtosServiceMock.listarCompras.mockResolvedValue([
      {
        id: 'c1', produtoId: 'p1', nome: 'Base', categoria: null, unidade: null,
        quantidade: 1, valorTotal: 50, dataCompra: '2026-09-10',
        observacao: null, encerrado: false, pessoasAtendidas: null, dataFim: null,
      },
    ]);
  }

  it('UT-30: deve montar série mensal com compras, consumo, extras e pessoas', async () => {
    produtosServiceMock.listarProdutos.mockResolvedValue([
      {
        id: 'p1', nome: 'Base', categoria: null, unidade: null,
        gastoEncerrado: 100, pessoasAtendidas: 10,
        quantidadeEncerrada: 1, custoPorPessoa: 10, lotesAbertos: 1,
      },
    ]);
    mocksBases();

    const resumo = await service.resumo();

    const ago = resumo.serieMensal.find((s) => s.mes === '2026-08');
    expect(ago).toBeDefined();
    expect(ago?.compras).toBe(100);
    expect(ago?.consumo).toBe(100);
    expect(ago?.extras).toBe(30);
    expect(ago?.pessoas).toBe(2);

    expect(resumo.totalGastoComprasEncerradas).toBe(100);
    expect(resumo.totalPessoasAtendidas).toBe(10);
    expect(resumo.custoMedioPessoa).toBe(10);
    expect(resumo.estoqueAtivo).toHaveLength(1);
    expect(resumo.topProdutos[0].nome).toBe('Base');
  });

  it('UT-31: deve retornar custoPorPessoa null quando não há atendimentos', async () => {
    produtosServiceMock.listarProdutos.mockResolvedValue([
      {
        id: 'p1', nome: 'Base', categoria: null, unidade: null,
        gastoEncerrado: 100, pessoasAtendidas: 0,
        quantidadeEncerrada: 1, custoPorPessoa: null, lotesAbertos: 0,
      },
    ]);
    mocksBases();

    const resumo = await service.resumo();

    expect(resumo.custoMedioPessoa).toBeNull();
  });
});