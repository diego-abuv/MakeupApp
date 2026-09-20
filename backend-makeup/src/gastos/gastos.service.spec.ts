import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GastosService } from './gastos.service';
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

describe('GastosService (TDD)', () => {
  let service: GastosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GastosService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabaseClient },
      ],
    }).compile();

    service = module.get<GastosService>(GastosService);
    jest.clearAllMocks();
  });

  it('UT-32: deve listar gastos ordenados por data', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'gastos') {
        return cadeia('select', 'order')({
          data: [{ id: 'g1', descricao: 'Curso', valor: 300 }],
          error: null,
        });
      }
      return cadeia('select')({ data: [], error: null });
    });

    const gastos = await service.listar();
    expect(gastos).toHaveLength(1);
    expect(gastos[0].descricao).toBe('Curso');
  });

  it('UT-33: deve criar um gasto com categoria CURSOS', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'gastos') {
        return cadeia('insert', 'select', 'single')({
          data: { id: 'g2', categoria: 'CURSO', descricao: 'Workshop', valor: 199.9 },
          error: null,
        });
      }
      return cadeia('select')({ data: [], error: null });
    });

    const gasto = await service.criar({
      categoria: 'CURSO',
      descricao: 'Workshop',
      valor: 199.9,
      data: '2026-08-15',
    });

    expect(gasto.valor).toBe(199.9);
  });

  it('UT-34: deve lançar BadRequest ao remover gasto inexistente', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'gastos') {
        return cadeia('select', 'eq', 'single')({
          data: null,
          error: { message: 'not found' },
        });
      }
      return cadeia('select')({ data: [], error: null });
    });

    await expect(service.remover('g1')).rejects.toThrow(BadRequestException);
  });
});