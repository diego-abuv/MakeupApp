import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import { Database } from '../types/database';
import { ExpedienteDiaDto } from './dto/config-agenda.dto';

export interface ExpedienteDia {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

@Injectable()
export class ConfigAgendaService {
  private readonly logger = new Logger(ConfigAgendaService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  async obter(): Promise<ExpedienteDia[]> {
    const { data, error } = await this.supabase
      .from('config_agenda')
      .select('dia_semana, hora_inicio, hora_fim')
      .order('dia_semana');

    if (error) {
      this.logger.error(`Erro ao obter expediente: ${error.code}:${error.message}`);
      return [];
    }

    return data ?? [];
  }

  async atualizar(expediente: ExpedienteDiaDto[]): Promise<ExpedienteDia[]> {
    const { error: delError } = await this.supabase
      .from('config_agenda')
      .delete()
      .neq('dia_semana', -1);

    if (delError) {
      this.logger.error(`Erro ao limpar expediente: ${delError.code}:${delError.message}`);
      throw new Error('Erro ao atualizar expediente');
    }

    if (expediente.length === 0) return this.obter();

    const linhas = expediente.map((d) => ({
      dia_semana: d.dia_semana,
      hora_inicio: d.hora_inicio,
      hora_fim: d.hora_fim,
    }));

    const { error: insError } = await this.supabase
      .from('config_agenda')
      .insert(linhas);

    if (insError) {
      this.logger.error(`Erro ao salvar expediente: ${insError.code}:${insError.message}`);
      throw new Error('Erro ao salvar expediente');
    }

    return this.obter();
  }
}
