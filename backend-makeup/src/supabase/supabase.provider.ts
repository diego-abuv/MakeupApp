import { Provider } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

export const supabaseProvider: Provider = {
  provide: SUPABASE_CLIENT,
  useFactory: (): SupabaseClient<Database> => {
    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        'Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_ANON_KEY) são obrigatórias.',
      );
    }

    return createClient<Database>(url, key);
  },
};
