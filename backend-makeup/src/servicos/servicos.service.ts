import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import { Database, ServicoRow } from '../types/database';
import { AtualizarServicoDto, CriarServicoDto } from './dto/servico.dto';

export type ServicoVisao = Pick<
  ServicoRow,
  'id' | 'nome' | 'preco' | 'duracao_minutos' | 'categoria' | 'ativo'
>;

const CAMPOS_VISAO = 'id, nome, preco, duracao_minutos, categoria, ativo';

@Injectable()
export class ServicosService {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  async listarAtivos(): Promise<
    Pick<
      ServicoRow,
      'id' | 'nome' | 'preco' | 'duracao_minutos' | 'categoria'
    >[]
  > {
    const { data, error } = await this.supabase
      .from('servicos')
      .select('id, nome, preco, duracao_minutos, categoria')
      .eq('ativo', true)
      .order('nome');

    if (error) {
      throw new InternalServerErrorException('Erro ao listar os serviços');
    }

    return data ?? [];
  }

  async listarTodos(): Promise<ServicoVisao[]> {
    const { data, error } = await this.supabase
      .from('servicos')
      .select(CAMPOS_VISAO)
      .order('nome');

    if (error) {
      throw new InternalServerErrorException('Erro ao listar os serviços');
    }

    return data ?? [];
  }

  async criar(dto: CriarServicoDto): Promise<ServicoVisao> {
    const { data, error } = await this.supabase
      .from('servicos')
      .insert({
        nome: dto.nome.trim(),
        preco: dto.preco,
        duracao_minutos: dto.duracao_minutos,
        categoria: dto.categoria,
        ativo: dto.ativo ?? true,
      })
      .select(CAMPOS_VISAO)
      .single();

    if (error) {
      throw new InternalServerErrorException('Erro ao criar o serviço');
    }

    return data;
  }

  async atualizar(id: string, dto: AtualizarServicoDto): Promise<ServicoVisao> {
    const { data: existente, error: existenteError } = await this.supabase
      .from('servicos')
      .select('id')
      .eq('id', id)
      .single();

    if (existenteError || !existente) {
      throw new BadRequestException('Serviço não encontrado');
    }

    const { data, error } = await this.supabase
      .from('servicos')
      .update({
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.preco !== undefined ? { preco: dto.preco } : {}),
        ...(dto.duracao_minutos !== undefined
          ? { duracao_minutos: dto.duracao_minutos }
          : {}),
        ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      })
      .eq('id', id)
      .select(CAMPOS_VISAO)
      .single();

    if (error) {
      throw new InternalServerErrorException('Erro ao atualizar o serviço');
    }

    return data;
  }

  async remover(id: string): Promise<void> {
    const { data: existente, error: existenteError } = await this.supabase
      .from('servicos')
      .select('id')
      .eq('id', id)
      .single();

    if (existenteError || !existente) {
      throw new BadRequestException('Serviço não encontrado');
    }

    const { error } = await this.supabase
      .from('servicos')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503') {
        throw new ConflictException(
          'Não é possível excluir: o serviço possui agendamentos. Desative-o.',
        );
      }
      throw new InternalServerErrorException('Erro ao excluir o serviço');
    }
  }
}
