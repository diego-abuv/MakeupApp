-- ============================================================
-- Seed de dados ficticios para validacao do Dashboard
-- 100% IDEMPOTENTE: pode rodar N vezes sem duplicar
-- Requer schema.sql ja executado
-- ============================================================

-- Servicos (idempotente via UNIQUE index no nome)
INSERT INTO servicos (nome, preco, duracao_minutos, categoria) VALUES
('Make Social', 120.00, 60, 'Social'),
('Make Noiva', 500.00, 120, 'Noiva'),
('Make Festa', 160.00, 75, 'Festa')
ON CONFLICT (nome) DO NOTHING;

-- Produtos (idempotente via UNIQUE index no nome)
INSERT INTO produtos (nome, categoria, unidade) VALUES
('Base Liquida', 'Base', 'UN'),
('Po Compacto', 'Base', 'UN'),
('Batom Matte', 'Batom', 'UN'),
('Mascara de Cilios', 'Olho', 'UN'),
('Pincel Kabuki', 'Pincel', 'UN')
ON CONFLICT (nome) DO NOTHING;

-- Compras: so insere se vazio
DO $$
DECLARE
  ja_existe INT;
  p_base UUID;
  p_po UUID;
  p_batom UUID;
  p_mascara UUID;
  p_pincel UUID;
BEGIN
  SELECT COUNT(*) INTO ja_existe FROM compras;
  IF ja_existe > 0 THEN
    RAISE NOTICE 'Compras ja existentes, pulando.';
    RETURN;
  END IF;

  SELECT id INTO p_base FROM produtos WHERE nome = 'Base Liquida';
  SELECT id INTO p_po FROM produtos WHERE nome = 'Po Compacto';
  SELECT id INTO p_batom FROM produtos WHERE nome = 'Batom Matte';
  SELECT id INTO p_mascara FROM produtos WHERE nome = 'Mascara de Cilios';
  SELECT id INTO p_pincel FROM produtos WHERE nome = 'Pincel Kabuki';

  INSERT INTO compras (produto_id, quantidade, valor_total, data_compra) VALUES
  (p_base, 5, 250.00, '2026-07-05'),
  (p_po, 3, 120.00, '2026-07-10'),
  (p_batom, 8, 320.00, '2026-07-15'),
  (p_mascara, 4, 200.00, '2026-07-20'),
  (p_pincel, 2, 180.00, '2026-07-25'),
  (p_base, 6, 300.00, '2026-08-03'),
  (p_po, 4, 160.00, '2026-08-08'),
  (p_batom, 10, 400.00, '2026-08-12'),
  (p_mascara, 5, 250.00, '2026-08-18'),
  (p_pincel, 3, 270.00, '2026-08-22'),
  (p_base, 7, 350.00, '2026-09-02'),
  (p_po, 5, 200.00, '2026-09-07'),
  (p_batom, 12, 480.00, '2026-09-10'),
  (p_mascara, 6, 300.00, '2026-09-15'),
  (p_pincel, 4, 360.00, '2026-09-18');
END $$;

-- Encerramentos: so insere se vazio
DO $$
DECLARE
  ja_existe INT;
  r RECORD;
  enc_count INT := 0;
BEGIN
  SELECT COUNT(*) INTO ja_existe FROM encerramentos;
  IF ja_existe > 0 THEN
    RAISE NOTICE 'Encerramentos ja existentes, pulando.';
    RETURN;
  END IF;

  FOR r IN
    SELECT id, data_compra FROM compras
    WHERE data_compra < '2026-09-01'
    ORDER BY data_compra LIMIT 8
  LOOP
    enc_count := enc_count + 1;
    INSERT INTO encerramentos (compra_id, pessoas_atendidas, data_fim, observacao)
    VALUES (
      r.id,
      (enc_count * 3 + 2),
      (r.data_compra + INTERVAL '25 days')::date,
      'Lote ficticio para teste do dashboard'
    )
    ON CONFLICT (compra_id) DO NOTHING;
  END LOOP;
END $$;

-- Agendamentos: so insere se nao existir nenhum CONCLUIDO
DO $$
DECLARE
  ja_existe INT;
  s_social UUID;
  s_festa UUID;
  s_noiva UUID;
  mes INT;
  dia INT;
  hora INT;
  ag_count INT := 0;
  nomes TEXT[] := ARRAY[
    'Ana Silva', 'Bruna Costa', 'Carla Dias', 'Diana Ferreira',
    'Elena Martins', 'Fernanda Lima', 'Gabriela Souza', 'Helena Santos',
    'Isabela Rocha', 'Juliana Alves', 'Katia Mendes', 'Larissa Pinto',
    'Mariana Oliveira', 'Natalia Ribeiro', 'Olga Campos'
  ];
  whats TEXT[] := ARRAY[
    '5535999000001', '5535999000002', '5535999000003', '5535999000004',
    '5535999000005', '5535999000006', '5535999000007', '5535999000008',
    '5535999000009', '5535999000010', '5535999000011', '5535999000012',
    '5535999000013', '5535999000014', '5535999000015'
  ];
  serv UUID[];
  dur INT[];
BEGIN
  SELECT COUNT(*) INTO ja_existe FROM agendamentos WHERE status = 'CONCLUIDO';
  IF ja_existe > 0 THEN
    RAISE NOTICE 'Agendamentos ja existentes, pulando.';
    RETURN;
  END IF;

  SELECT id INTO s_social FROM servicos WHERE nome = 'Make Social';
  SELECT id INTO s_festa FROM servicos WHERE nome = 'Make Festa';
  SELECT id INTO s_noiva FROM servicos WHERE nome = 'Make Noiva';
  serv := ARRAY[s_social, s_festa, s_noiva];
  dur := ARRAY[60, 75, 120];

  FOR mes IN 7..9 LOOP
    FOR dia IN 5..28 LOOP
      IF random() > 0.45 THEN
        ag_count := ag_count + 1;
        hora := 9 + (ag_count % 8);
        IF hora > 18 THEN hora := 9; END IF;

        INSERT INTO agendamentos (
          cliente_nome, cliente_whatsapp, servico_id,
          data_hora_inicio, data_hora_fim,
          status, pagamento_status
        ) VALUES (
          nomes[((ag_count - 1) % 15) + 1],
          whats[((ag_count - 1) % 15) + 1],
          serv[((ag_count - 1) % 3) + 1],
          make_timestamptz(2026, mes, dia, hora, 0, 0, 'America/Sao_Paulo'),
          make_timestamptz(2026, mes, dia, hora + dur[((ag_count - 1) % 3) + 1] / 60, dur[((ag_count - 1) % 3) + 1] % 60, 0, 'America/Sao_Paulo'),
          'CONCLUIDO',
          'PAGO'
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Gastos: so insere se vazio
DO $$
DECLARE
  ja_existe INT;
  mes INT;
  g_count INT := 0;
  cats TEXT[] := ARRAY['TRANSPORTE', 'FERRAMENTA', 'CURSO', 'OUTRO'];
  descs TEXT[] := ARRAY['Uber para cliente', 'Pincel novo', 'Curso de maquiagem', 'Material de apoio'];
BEGIN
  SELECT COUNT(*) INTO ja_existe FROM gastos;
  IF ja_existe > 0 THEN
    RAISE NOTICE 'Gastos ja existentes, pulando.';
    RETURN;
  END IF;

  FOR mes IN 7..9 LOOP
    FOR g_count IN 1..4 LOOP
      INSERT INTO gastos (categoria, descricao, valor, data)
      VALUES (
        cats[g_count],
        descs[g_count],
        (50 + random() * 200)::numeric(10,2),
        make_date(2026, mes, 5 + g_count * 5)
      );
    END LOOP;
  END LOOP;
END $$;

-- Bloqueios almoco: so insere se vazio
DO $$
DECLARE
  ja_existe INT;
BEGIN
  SELECT COUNT(*) INTO ja_existe FROM bloqueios WHERE tipo = 'ALMOCO';
  IF ja_existe > 0 THEN
    RAISE NOTICE 'Bloqueios ja existentes, pulando.';
    RETURN;
  END IF;

  INSERT INTO bloqueios (data_hora_inicio, data_hora_fim, motivo, recorrente, dia_semana, tipo)
  VALUES
  ('2000-01-03T12:00:00Z', '2000-01-03T13:00:00Z', 'Almoco', true, 1, 'ALMOCO'),
  ('2000-01-04T12:00:00Z', '2000-01-04T13:00:00Z', 'Almoco', true, 2, 'ALMOCO'),
  ('2000-01-05T12:00:00Z', '2000-01-05T13:00:00Z', 'Almoco', true, 3, 'ALMOCO'),
  ('2000-01-06T12:00:00Z', '2000-01-06T13:00:00Z', 'Almoco', true, 4, 'ALMOCO'),
  ('2000-01-07T12:00:00Z', '2000-01-07T13:00:00Z', 'Almoco', true, 5, 'ALMOCO'),
  ('2000-01-08T12:00:00Z', '2000-01-08T13:00:00Z', 'Almoco', true, 6, 'ALMOCO');
END $$;

-- Config agenda (upsert idempotente)
INSERT INTO config_agenda (dia_semana, hora_inicio, hora_fim) VALUES
(0, '08:00', '20:00'),
(1, '09:00', '19:00'),
(2, '09:00', '19:00'),
(3, '09:00', '19:00'),
(4, '09:00', '19:00'),
(5, '09:00', '19:00'),
(6, '09:00', '19:00')
ON CONFLICT (dia_semana) DO UPDATE
SET hora_inicio = EXCLUDED.hora_inicio,
    hora_fim = EXCLUDED.hora_fim;
