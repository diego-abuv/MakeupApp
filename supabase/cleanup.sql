-- ============================================================
-- Cleanup: remove todos os dados ficticios
-- Mantem: schema, admin_users, refresh_tokens, config_agenda
-- Pode rodar N vezes (idempotente)
-- ============================================================

-- Remove dados em ordem (respeita FKs)
DELETE FROM agendamentos WHERE status = 'CONCLUIDO';
DELETE FROM encerramentos;
DELETE FROM gastos;
DELETE FROM bloqueios WHERE tipo = 'ALMOCO';
DELETE FROM compras;
DELETE FROM produtos WHERE nome IN (
  'Base Liquida', 'Po Compacto', 'Batom Matte', 'Mascara de Cilios', 'Pincel Kabuki'
);
DELETE FROM servicos WHERE nome IN (
  'Make Social', 'Make Noiva', 'Make Festa'
);

-- Reseta config_agenda para padrao (seg-dom 08:00-20:00)
DELETE FROM config_agenda;
INSERT INTO config_agenda (dia_semana, hora_inicio, hora_fim) VALUES
(0, '08:00', '20:00'),
(1, '08:00', '20:00'),
(2, '08:00', '20:00'),
(3, '08:00', '20:00'),
(4, '08:00', '20:00'),
(5, '08:00', '20:00'),
(6, '08:00', '20:00');

-- Reinsere servicos padrao
INSERT INTO servicos (nome, preco, duracao_minutos, categoria) VALUES
('Make Social', 120.00, 60, 'Social'),
('Make Noiva', 500.00, 120, 'Noiva'),
('Make Festa', 160.00, 75, 'Festa')
ON CONFLICT (nome) DO NOTHING;

SELECT 'Cleanup concluido. Dados fake removidos, servicos e config restaurados.' AS resultado;
