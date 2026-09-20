// Cria ou atualiza um usuário admin no painel.
// Uso: npm run criar-admin -- usuario "senha"
// Requer SUPABASE_URL e SUPABASE_SERVICE_KEY no .env (service role ignora RLS).
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const [usernameRaw, senha] = process.argv.slice(2);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!usernameRaw || !senha) {
  fail('Uso: npm run criar-admin -- usuario "senha"');
}
if (!/^[a-zA-Z0-9_.]{3,50}$/.test(usernameRaw)) {
  fail(
    'Usuário inválido (use 3 a 50 caracteres: letras, números, ponto ou underline).',
  );
}
if (senha.length < 8) {
  fail('A senha deve ter ao menos 8 caracteres.');
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  fail(
    'Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no arquivo .env antes de rodar.',
  );
}

const supabase = createClient(url, key);
const username = usernameRaw.toLowerCase().trim();
const password_hash = bcrypt.hashSync(senha, 10);

const { data, error } = await supabase
  .from('admin_users')
  .upsert(
    { username, password_hash, role: 'admin', blocked: false },
    { onConflict: 'username' },
  )
  .select('id, username, role, blocked')
  .single();

if (error) {
  fail(`Erro ao salvar o admin: ${error.message}`);
}

console.log('Admin pronto:');
console.log(data);
console.log('Use esse usuário e senha para entrar em /admin.');
