import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import { Database, GastoRow } from '../types/database';
import {
  AtualizarGastoDto,
  CriarGastoDto,
} from './dto/gastos.dto';

@Injectable()
export class GastosService {
  private readonly logger = new Logger(GastosService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  async listar(): Promise<GastoRow[]> {
    const { data, error } = await this.supabase
      .from('gastos')
      .select()
      .order('data', { ascending: false });

    if (error) {
      this.logger.error(
        `Erro ao listar gastos: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException('Erro ao listar os gastos');
    }

    return data ?? [];
  }

  async criar(dto: CriarGastoDto): Promise<GastoRow> {
    const { data, error } = await this.supabase
      .from('gastos')
      .insert({
        categoria: dto.categoria,
        descricao: dto.descricao.trim(),
        valor: dto.valor,
        data: dto.data,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Erro ao lançar gasto: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException('Erro ao lançar o gasto');
    }

    return data;
  }

  async atualizar(id: string, dto: AtualizarGastoDto): Promise<GastoRow> {
    const { data, error } = await this.supabase
      .from('gastos')
      .update({
        ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
        ...(dto.descricao !== undefined
          ? { descricao: dto.descricao.trim() }
          : {}),
        ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
        ...(dto.data !== undefined ? { data: dto.data } : {}),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestException('Gasto não encontrado');
    }

    return data;
  }

  async remover(id: string): Promise<void> {
    const { data: existente, error: existenteError } = await this.supabase
      .from('gastos')
      .select('id')
      .eq('id', id)
      .single();

    if (existenteError || !existente) {
      throw new BadRequestException('Gasto não encontrado');
    }

    const { error } = await this.supabase.from('gastos').delete().eq('id', id);

    if (error) {
      throw new InternalServerErrorException('Erro ao excluir o gasto');
    }
  }
}