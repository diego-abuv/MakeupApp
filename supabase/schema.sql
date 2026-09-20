-- MakeupApp - DDL Supabase / PostgreSQL
-- Executar no SQL Editor do Supabase (idempotente)

-- Habilitar extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Extensão para índices de exclusão de intervalo (anti double-booking)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Tabela de Serviços
CREATE TABLE IF NOT EXISTS servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    duracao_minutos INT NOT NULL,
    categoria VARCHAR(50) DEFAULT 'Social',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Backward-compat: garante a coluna para bancos já criados (idempotente)
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'Social';
CREATE UNIQUE INDEX IF NOT EXISTS servicos_nome_key ON servicos (nome);

-- 2. Tabela de Agendamentos (inclui sinal Pix de 50%)
CREATE TABLE IF NOT EXISTS agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_nome VARCHAR(100) NOT NULL,
    cliente_whatsapp VARCHAR(20) NOT NULL,
    cliente_email VARCHAR(255),
    cliente_cpf VARCHAR(11),
    servico_id UUID REFERENCES servicos(id) ON DELETE RESTRICT,
    data_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_hora_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'AGUARDANDO_SINAL',
    -- Pagamentos / sinal de 50%
    sinal_valor DECIMAL(10,2),
    sinal_expiracao TIMESTAMP WITH TIME ZONE,
    pagamento_status VARCHAR(20) DEFAULT 'AGUARDANDO', -- AGUARDANDO | PAGO | EXPIRADO | CANCELADO
    gateway_payment_id VARCHAR(64),
    gateway_customer_id VARCHAR(64),
    pix_qr_base64 TEXT,
    pix_copia_cola TEXT,
    pix_expiracao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Backward-compat das novas colunas (idempotente)
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(255);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_cpf VARCHAR(11);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS sinal_valor DECIMAL(10,2);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS sinal_expiracao TIMESTAMP WITH TIME ZONE;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS pagamento_status VARCHAR(20) DEFAULT 'AGUARDANDO';
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(64);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS gateway_customer_id VARCHAR(64);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS pix_qr_base64 TEXT;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS pix_copia_cola TEXT;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS pix_expiracao TIMESTAMP WITH TIME ZONE;

-- 3. Tabela de Bloqueios na Agenda
CREATE TABLE IF NOT EXISTS bloqueios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_hora_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    motivo VARCHAR(100),
    recorrente BOOLEAN NOT NULL DEFAULT false,
    dia_semana SMALLINT, -- 0=domingo ... 6=sábado (quando recorrente)
    tipo VARCHAR(20) NOT NULL DEFAULT 'IMPREVISTO', -- ALMOCO | FOLGA | IMPREVISTO
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE bloqueios ADD COLUMN IF NOT EXISTS recorrente BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bloqueios ADD COLUMN IF NOT EXISTS dia_semana SMALLINT;
ALTER TABLE bloqueios ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'IMPREVISTO';

-- Índices para consulta de slots
CREATE INDEX IF NOT EXISTS idx_agendamentos_inicio ON agendamentos (data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos (status);
CREATE INDEX IF NOT EXISTS idx_bloqueios_inicio ON bloqueios (data_hora_inicio);

-- 3b. Tabela de Configuração de Expediente (dias/horários de atendimento)
CREATE TABLE IF NOT EXISTS config_agenda (
    dia_semana SMALLINT NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
    hora_inicio VARCHAR(5) NOT NULL, -- HH:mm
    hora_fim VARCHAR(5) NOT NULL,   -- HH:mm
    PRIMARY KEY (dia_semana)
);

-- 4. Tabela de Produtos (catálogo de insumos sem estoque físico fino)
CREATE TABLE IF NOT EXISTS produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) DEFAULT 'Produto', -- Base, Batom, Sombra, Pincel, ...
    unidade VARCHAR(10) DEFAULT 'UN', -- UN | ML | GR
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS produtos_nome_key ON produtos (nome);

-- 5. Tabela de Compras (lote comprado de um produto)
CREATE TABLE IF NOT EXISTS compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    quantidade DECIMAL(10,2) NOT NULL DEFAULT 1,
    valor_total DECIMAL(10,2) NOT NULL,
    data_compra DATE NOT NULL,
    observacao VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_compras_data ON compras (data_compra);
CREATE INDEX IF NOT EXISTS idx_compras_produto ON compras (produto_id);

-- 6. Tabela de Encerramentos (lote que acabou / perdeu / estragou)
CREATE TABLE IF NOT EXISTS encerramentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compra_id UUID NOT NULL UNIQUE REFERENCES compras(id) ON DELETE CASCADE,
    pessoas_atendidas INT NOT NULL DEFAULT 0, -- calculado automaticamente
    data_fim DATE NOT NULL,
    observacao VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_encerramentos_data ON encerramentos (data_fim);

-- 7. Tabela de Gastos (despesas fora de produto)
CREATE TABLE IF NOT EXISTS gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria VARCHAR(30) NOT NULL DEFAULT 'OUTRO', -- CURSO | FERRAMENTA | TRANSPORTE | OUTRO
    descricao VARCHAR(200) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_gastos_data ON gastos (data);

-- 8. Tabela de Admin
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin',
    blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE admin_users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
UPDATE admin_users
    SET username = COALESCE(username, lower(split_part(email, '@', 1)))
    WHERE username IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_key ON admin_users (username);
ALTER TABLE admin_users ALTER COLUMN username SET NOT NULL;

-- 9. Tabela de Tokens de Refresh
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ============================================================
-- Anti double-booking
-- ============================================================
-- Agendamentos/bloqueios não podem se sobrepor entre si.
-- IMPORTANTE: agendamentos CANCELADOS/EXPIRADOS liberam o slot (o conflito
-- só é bloqueado para status que "seguram" o horário).
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_no_overlap;
ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_no_overlap
    EXCLUDE USING gist (
        tstzrange(data_hora_inicio, data_hora_fim) WITH &&
    ) WHERE (status::text NOT IN ('CANCELADO', 'EXPIRADO'));

ALTER TABLE bloqueios DROP CONSTRAINT IF EXISTS bloqueios_no_overlap;
ALTER TABLE bloqueios ADD CONSTRAINT bloqueios_no_overlap
    EXCLUDE USING gist (
        tstzrange(data_hora_inicio, data_hora_fim) WITH &&
    );

-- ============================================================
-- Seed
-- ============================================================
INSERT INTO servicos (nome, preco, duracao_minutos, categoria) VALUES
('Make Social', 120.00, 60, 'Social'),
('Make Noiva', 500.00, 120, 'Noiva'),
('Make Festa', 160.00, 75, 'Festa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "servicos_public_read" ON servicos;
CREATE POLICY "servicos_public_read" ON servicos
    FOR SELECT USING (true);

ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueios ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE encerramentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_agenda ENABLE ROW LEVEL SECURITY;

-- config_agenda: admin leitura/escrita, público leitura (para booking)
DROP POLICY IF EXISTS "config_agenda_admin_all" ON config_agenda;
CREATE POLICY "config_agenda_admin_all" ON config_agenda
    FOR ALL USING (true) WITH CHECK (true);

-- Seed padrão: seg-sáb 08:00–20:00 (se vazio, o backend usa horario.config como fallback)
INSERT INTO config_agenda (dia_semana, hora_inicio, hora_fim) VALUES
(0, '08:00', '20:00'),
(1, '08:00', '20:00'),
(2, '08:00', '20:00'),
(3, '08:00', '20:00'),
(4, '08:00', '20:00'),
(5, '08:00', '20:00'),
(6, '08:00', '20:00')
ON CONFLICT (dia_semana) DO NOTHING;

-- O fluxo público usa a anon/publishable key em subset de tabelas.
-- Regras de negócio (anti double-booking, sinal Pix) ficam no backend.
DROP POLICY IF EXISTS "agendamentos_anon_select" ON agendamentos;
CREATE POLICY "agendamentos_anon_select" ON agendamentos
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "agendamentos_anon_insert" ON agendamentos;
CREATE POLICY "agendamentos_anon_insert" ON agendamentos
    FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "agendamentos_anon_update" ON agendamentos;
CREATE POLICY "agendamentos_anon_update" ON agendamentos
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "bloqueios_anon_select" ON bloqueios;
CREATE POLICY "bloqueios_anon_select" ON bloqueios
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "bloqueios_anon_insert" ON bloqueios;
CREATE POLICY "bloqueios_anon_insert" ON bloqueios
    FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "bloqueios_anon_update" ON bloqueios;
CREATE POLICY "bloqueios_anon_update" ON bloqueios
    FOR UPDATE USING (true);

-- Admin leitura/escrita nas tabelas de insumos e gastos (via service key no backend)
DROP POLICY IF EXISTS "produtos_all_admin" ON produtos;
CREATE POLICY "produtos_all_admin" ON produtos
    FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "compras_all_admin" ON compras;
CREATE POLICY "compras_all_admin" ON compras
    FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "encerramentos_all_admin" ON encerramentos;
CREATE POLICY "encerramentos_all_admin" ON encerramentos
    FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "gastos_all_admin" ON gastos;
CREATE POLICY "gastos_all_admin" ON gastos
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Criação do primeiro admin (hash precisa ser válido para o login)
-- Use o script do backend:
--   npm run criar-admin -- maquiadora "sua-senha"
-- ============================================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;