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
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import { Database, ProdutoRow } from '../types/database';
import { FUSO_HORARIO } from '../horario.config';
import {
  AtualizarCompraDto,
  AtualizarProdutoDto,
  CriarCompraDto,
  CriarProdutoDto,
  EncerrarCompraDto,
} from './dto/produtos.dto';

export interface ProdutoResumo {
  id: string;
  nome: string;
  categoria: string | null;
  unidade: string | null;
  gastoEncerrado: number;
  pessoasAtendidas: number;
  quantidadeEncerrada: number;
  custoPorPessoa: number | null;
  lotesAbertos: number;
}

export interface CompraVisao {
  id: string;
  produtoId: string;
  nome: string;
  categoria: string | null;
  unidade: string | null;
  quantidade: number;
  valorTotal: number;
  dataCompra: string;
  observacao: string | null;
  encerrado: boolean;
  pessoasAtendidas: number | null;
  dataFim: string | null;
}

const CAMPOS_COMPRA =
  '*, produtos(id, nome, categoria, unidade), encerramentos(pessoas_atendidas, data_fim)';

@Injectable()
export class ProdutosService {
  private readonly logger = new Logger(ProdutosService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  private arredondar(valor: number): number {
    return Number(valor.toFixed(2));
  }

  async listarProdutos(): Promise<ProdutoResumo[]> {
    const compras = await this.listarCompras();

    const mapa = new Map<string, ProdutoResumo>();

    for (const compra of compras) {
      let resumo = mapa.get(compra.produtoId);
      if (!resumo) {
        resumo = {
          id: compra.produtoId,
          nome: compra.nome,
          categoria: compra.categoria,
          unidade: compra.unidade,
          gastoEncerrado: 0,
          pessoasAtendidas: 0,
          quantidadeEncerrada: 0,
          custoPorPessoa: null,
          lotesAbertos: 0,
        };
        mapa.set(compra.produtoId, resumo);
      }
      if (compra.encerrado) {
        resumo.gastoEncerrado = this.arredondar(
          resumo.gastoEncerrado + compra.valorTotal,
        );
        resumo.quantidadeEncerrada = this.arredondar(
          resumo.quantidadeEncerrada + compra.quantidade,
        );
        resumo.pessoasAtendidas += compra.pessoasAtendidas ?? 0;
      } else {
        resumo.lotesAbertos += 1;
      }
    }

    for (const resumo of mapa.values()) {
      resumo.custoPorPessoa =
        resumo.pessoasAtendidas > 0
          ? this.arredondar(resumo.gastoEncerrado / resumo.pessoasAtendidas)
          : null;
    }

    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async listarCompras(): Promise<CompraVisao[]> {
    const { data, error } = await this.supabase
      .from('compras')
      .select(CAMPOS_COMPRA)
      .order('data_compra', { ascending: false });

    if (error) {
      this.logger.error(
        `Erro ao listar compras: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException('Erro ao listar as compras');
    }

    return (data ?? []).map((linha) => {
      const produtos = linha.produtos ?? null;
      const encerramento = linha.encerramentos ?? null;
      return {
        id: linha.id,
        produtoId: linha.produto_id,
        nome: produtos?.nome ?? 'Produto removido',
        categoria: produtos?.categoria ?? null,
        unidade: produtos?.unidade ?? null,
        quantidade: Number(linha.quantidade),
        valorTotal: Number(linha.valor_total),
        dataCompra: linha.data_compra,
        observacao: linha.observacao ?? null,
        encerrado: Boolean(encerramento),
        pessoasAtendidas: encerramento?.pessoas_atendidas ?? null,
        dataFim: encerramento?.data_fim ?? null,
      };
    });
  }

  async criarProduto(dto: CriarProdutoDto): Promise<ProdutoRow> {
    const { data, error } = await this.supabase
      .from('produtos')
      .insert({
        nome: dto.nome.trim(),
        categoria: dto.categoria?.trim(),
        unidade: dto.unidade?.trim() ?? 'UN',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(
        `Erro ao criar produto: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException('Erro ao criar o produto');
    }

    return data;
  }

  private async buscarProduto(id: string): Promise<ProdutoRow | null> {
    const { data, error } = await this.supabase
      .from('produtos')
      .select()
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data;
  }

  async atualizarProduto(
    id: string,
    dto: AtualizarProdutoDto,
  ): Promise<ProdutoRow> {
    if (!(await this.buscarProduto(id))) {
      throw new BadRequestException('Produto não encontrado');
    }

    const { data, error } = await this.supabase
      .from('produtos')
      .update({
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.categoria !== undefined ? { categoria: dto.categoria.trim() } : {}),
        ...(dto.unidade !== undefined ? { unidade: dto.unidade.trim() } : {}),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException('Erro ao atualizar o produto');
    }

    return data;
  }

  async removerProduto(id: string): Promise<void> {
    if (!(await this.buscarProduto(id))) {
      throw new BadRequestException('Produto não encontrado');
    }

    const { error } = await this.supabase.from('produtos').delete().eq('id', id);

    if (error) {
      if (error.code === '23503') {
        throw new ConflictException(
          'Não é possível excluir: o produto possui compras registradas.',
        );
      }
      throw new InternalServerErrorException('Erro ao excluir o produto');
    }
  }

  async criarCompra(dto: CriarCompraDto): Promise<CompraVisao> {
    if (!(await this.buscarProduto(dto.produtoId))) {
      throw new BadRequestException('Produto não encontrado');
    }

    const { data, error } = await this.supabase
      .from('compras')
      .insert({
        produto_id: dto.produtoId,
        quantidade: dto.quantidade,
        valor_total: dto.valorTotal,
        data_compra: dto.dataCompra,
        observacao: dto.observacao?.trim() || null,
      })
      .select(CAMPOS_COMPRA)
      .single();

    if (error) {
      this.logger.error(
        `Erro ao lançar compra: code=${error.code} message=${error.message}`,
      );
      throw new InternalServerErrorException('Erro ao lançar a compra');
    }

    return this.visao(data);
  }

  private visao(linha: unknown): CompraVisao {
    const l = linha as {
      id: string;
      produto_id: string;
      quantidade: number;
      valor_total: number;
      data_compra: string;
      observacao: string | null;
      produtos?: { nome: string; categoria: string | null; unidade: string | null } | null;
      encerramentos?: { pessoas_atendidas: number; data_fim: string } | null;
    };
    return {
      id: l.id,
      produtoId: l.produto_id,
      nome: l.produtos?.nome ?? 'Produto removido',
      categoria: l.produtos?.categoria ?? null,
      unidade: l.produtos?.unidade ?? null,
      quantidade: Number(l.quantidade),
      valorTotal: Number(l.valor_total),
      dataCompra: l.data_compra,
      observacao: l.observacao ?? null,
      encerrado: Boolean(l.encerramentos),
      pessoasAtendidas: l.encerramentos?.pessoas_atendidas ?? null,
      dataFim: l.encerramentos?.data_fim ?? null,
    };
  }

  async atualizarCompra(
    id: string,
    dto: AtualizarCompraDto,
  ): Promise<CompraVisao> {
    const { data: encerrada, error: encerradaError } = await this.supabase
      .from('encerramentos')
      .select('id')
      .eq('compra_id', id)
      .maybeSingle();

    if (encerradaError) {
      throw new InternalServerErrorException('Erro ao validar a compra');
    }
    if (encerrada) {
      throw new ConflictException(
        'Não é possível editar uma compra já encerrada',
      );
    }

    const { data, error } = await this.supabase
      .from('compras')
      .update({
        ...(dto.quantidade !== undefined ? { quantidade: dto.quantidade } : {}),
        ...(dto.valorTotal !== undefined ? { valor_total: dto.valorTotal } : {}),
        ...(dto.dataCompra !== undefined ? { data_compra: dto.dataCompra } : {}),
        ...(dto.observacao !== undefined ? { observacao: dto.observacao } : {}),
      })
      .eq('id', id)
      .select(CAMPOS_COMPRA)
      .single();

    if (error || !data) {
      throw new BadRequestException('Compra não encontrada');
    }

    return this.visao(data);
  }

  async removerCompra(id: string): Promise<void> {
    const { data: encerrada, error: encerradaError } = await this.supabase
      .from('encerramentos')
      .select('id')
      .eq('compra_id', id)
      .maybeSingle();

    if (encerradaError) {
      throw new InternalServerErrorException('Erro ao validar a compra');
    }
    if (encerrada) {
      throw new ConflictException(
        'Não é possível excluir uma compra já encerrada',
      );
    }

    const { data: existente, error: existenteError } = await this.supabase
      .from('compras')
      .select('id')
      .eq('id', id)
      .single();

    if (existenteError || !existente) {
      throw new BadRequestException('Compra não encontrada');
    }

    const { error } = await this.supabase.from('compras').delete().eq('id', id);

    if (error) {
      throw new InternalServerErrorException('Erro ao excluir a compra');
    }
  }

  async encerrarCompra(
    compraId: string,
    dto: EncerrarCompraDto,
  ): Promise<CompraVisao> {
    const { data: compra, error: compraError } = await this.supabase
      .from('compras')
      .select('id, data_compra, quantidade, valor_total, produtos(nome)')
      .eq('id', compraId)
      .single();

    if (compraError || !compra) {
      throw new BadRequestException('Compra não encontrada');
    }

    const { data: jaEncerrada, error: jaEncerradaError } = await this.supabase
      .from('encerramentos')
      .select('id')
      .eq('compra_id', compraId)
      .maybeSingle();

    if (jaEncerradaError) {
      throw new InternalServerErrorException(
        'Erro ao validar o encerramento',
      );
    }
    if (jaEncerrada) {
      throw new ConflictException('Este lote já foi encerrado');
    }

    // pessoas_atendidas é calculado automaticamente: atendimentos CONCLUIDO
    // entre a data da compra do lote e a data de encerramento.
    const inicioContagem = fromZonedTime(
      `${compra.data_compra}T00:00:00`,
      FUSO_HORARIO,
    ).toISOString();
    const fimContagem = fromZonedTime(
      `${dto.dataFim}T23:59:59`,
      FUSO_HORARIO,
    ).toISOString();

    const { count, error: countError } = await this.supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'CONCLUIDO')
      .gte('data_hora_inicio', inicioContagem)
      .lte('data_hora_inicio', fimContagem);

    if (countError) {
      this.logger.error(
        `Erro ao contar atendimentos: code=${countError.code} message=${countError.message}`,
      );
      throw new InternalServerErrorException(
        'Erro ao calcular as pessoas atendidas',
      );
    }

    const { data: encerrado, error: encerradoError } = await this.supabase
      .from('encerramentos')
      .insert({
        compra_id: compraId,
        pessoas_atendidas: count ?? 0,
        data_fim: dto.dataFim,
        observacao: dto.observacao?.trim() || null,
      })
      .select('id, pessoas_atendidas, data_fim')
      .single();

    if (encerradoError) {
      this.logger.error(
        `Erro ao encerrar lote: code=${encerradoError.code} message=${encerradoError.message}`,
      );
      throw new InternalServerErrorException('Erro ao encerrar o lote');
    }

    this.logger.log(
      `Lote ${compraId} encerrado: ${encerrado.pessoas_atendidas} pessoa(s) atendida(s).`,
    );

    return {
      id: compraId,
      produtoId: '',
      nome: compra.produtos?.nome ?? '',
      categoria: null,
      unidade: null,
      quantidade: Number(compra.quantidade),
      valorTotal: Number(compra.valor_total),
      dataCompra: compra.data_compra,
      observacao: null,
      encerrado: true,
      pessoasAtendidas: encerrado.pessoas_atendidas,
      dataFim: encerrado.data_fim,
    };
  }
}