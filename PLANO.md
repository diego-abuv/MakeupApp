# MakeupApp — Plano de Implementação (MVP)

> **Status:** Em desenvolvimento
> **Base:** BarberApp V1 (repo sincronizado com `origin/main`)
> **Arquitetura:** NestJS (backend) + Supabase (PostgreSQL) + Next.js/Tailwind (frontend)
> **Critérios de aceite:** Mobile-first em todas as telas · TDD (Red → Green) no backend

---

## 1. Decisões de produto

| Tema | Decisão |
|---|---|
| Projeto | Novo repo `MakeupApp/` clonado do BarberApp (base atual: username/JWT+cookie, CSP nonce) |
| Pagamento (sinal 50%) | **Pix dinâmico via Asaas** na homologação (sandbox), com **adapter de gateway** normalizado para migração fácil pro Mercado Pago |
| Form do cliente | Coleta desde já tudo que o Mercado Pago vai precisar: **nome, WhatsApp, e-mail, CPF** (LGPD: finalidade e mínimo necessário) |
| Métrica de produto | `pessoas_atendidas` é calculada **automaticamente**: ao encerrar um lote, conta os atendimentos `CONCLUIDO` desde a data da compra do lote (não considera pendente/cancelado — quem pagou o sinal mas não foi) |
| Controle de gastos | Compra é sempre lançada (perda/estragou = encerramento), mas **só entra na conta de custo por pessoa** quando o lote é encerrado |
| Mobile-first | Todas as telas validadas a partir de 320px, sem scroll horizontal, alvos de toque ≥44px, font ≥16px nos inputs |
| TDD | Testes do backend Jest por módulo antes da implementação (Red → Green) |

---

## 2. Modelagem de dados (`supabase/schema.sql`)

### Alterações em `servicos`
```sql
categoria VARCHAR(50)  -- Noiva, Social, Festa, Penteado...
```

### Alterações em `agendamentos`
```sql
cliente_email      VARCHAR(255)
cliente_cpf        VARCHAR(11)
sinal_valor        DECIMAL(10,2)
sinal_expiracao    TIMESTAMPTZ        -- segura o slot por ~15 min
pagamento_status   VARCHAR(20) DEFAULT 'AGUARDANDO'  -- AGUARDANDO|PAGO|EXPIRADO|CANCELADO
gateway_payment_id VARCHAR(64)        -- id da cobrança no gateway
gateway_customer_id VARCHAR(64)       -- id do cliente no gateway
pix_qr_base64      TEXT               -- QR renderizado (base64, data:)
pix_copia_cola     TEXT               -- código copia-e-cola
pix_expiracao      TIMESTAMPTZ
```
Status do agendamento: `AGUARDANDO_SINAL` (criado) · `CONFIRMADO` (sinal pago) · `CONCLUIDO` · `CANCELADO` · `EXPIRADO`.

**Anti double-booking ajustado:** o EXCLUDE de sobreposição passa a ser condicionado a
`status NOT IN ('CANCELADO','EXPIRADO')` — assim cancelados/vencidos liberam o slot.

### Novas tabelas
```sql
produtos      (id, nome, categoria, unidade[UN|ML|GR], criado_em)
compras       (id, produto_id FK, quantidade DECIMAL, valor_total DECIMAL,
               data_compra DATE, criado_em)               -- lançada na compra (lote)
encerramentos (id, compra_id FK UNIQUE, pessoas_atendidas INT,
               data_fim DATE, criado_em)                  -- lançado quando o lote acabou
gastos        (id, categoria[CURSO|FERRAMENTA|TRANSPORTE|OUTRO], descricao,
               valor DECIMAL, data DATE, criado_em)       -- despesas fora de produto
```
RLS no padrão do repo (public read; anon insert/update necessários; regras no backend).

---

## 3. Backend (NestJS)

### Reuso
`auth` (username + JWT + refresh cookie, throttling) · `bloqueios` · `supabase` · `horario`.

### Adaptações
- **`servicos`**: campo `categoria` no DTO/CRUD/seed.
- **`agendamentos`**:
  - `criarAgendamento` → status `AGUARDANDO_SINAL`, `sinal_valor = round(preço × SINAL_PERCENTUAL, 2)`,
    `sinal_expiracao = now + SINAL_TTL_MINUTOS`, salva e-mail/CPF.
  - Antes de criar, **libera/expira** sinais vencidos (`AGUARDANDO_SINAL` expirado → `EXPIRADO`),
    para o slot voltar a ser reservável (EXCLUDE condicional).
  - Disponibilidade/bloqueios consideram `CONFIRMADO` **ou** `AGUARDANDO_SINAL` não expirado.
- DTO recebe `clienteEmail`, `clienteCpf` com validação (regex e dígito verificador do CPF).

### Novo módulo `pagamentos`
- `src/pagamentos/gateway/gateway.interface.ts` — contrato normalizado (pensado p/ MP):
  ```ts
  interface PagadorGateway { nome; whatsapp; email?; cpf? }
  interface CriarCobrancaInput { valor; vencimento; idExterno; pagador }
  interface CobrancaCriada { gatewayPaymentId; gatewayCustomerId; qrBase64; copiaECola; expiraEm }
  interface GatewayPagamento { criarCobranca(); cancelar() }
  ```
- `src/pagamentos/gateway/asaas.gateway.ts` — implementação atual (customers → payments PIX → pixQrCode; DELETE cancelar).
  *Futuro MP:* só outro adapter (+ mapper de payload) — nenhuma mudança no restante.
- Endpoints:
  - `POST /api/agendamentos/:id/pix` — gera/retorna QR do sinal (público).
  - `GET  /api/agendamentos/:id/pix` — re-retorna QR armazenado (público, p/ "meus agendamentos").
  - `POST /api/pagamentos/webhook/asaas` — valida token/assinatura; `PAYMENT_CONFIRMED` → `PAGO`+`CONFIRMADO`; idempotente.
  - `POST /api/agendamentos/:id/cancelar-sinal` (admin) — cancela cobrança no gateway + libera slot.
- Store: `gateway_payment_id`, `gateway_customer_id`, `pix_qr_base64`, `pix_copia_cola`, `pix_expiracao`.

### Novo módulo `produtos` (admin)
- CRUD de `produtos`; criar `compras` (lote); criar `encerramentos`.
- **Encerrar lote ⇒ calcula automaticamente `pessoas_atendidas = count(agendamentos CONCLUIDO com data_hora_inicio entre data_compra e data_fim)`** — sem input manual.

### Novo módulo `gastos` (admin)
- CRUD de despesas (categoria, descrição, valor, data).

### Novo módulo `dashboard` (admin)
- Resumo produtos (por produto: gasto encerrado, pessoas, **custo/pessoa**, lotes em aberto, estoque).
- Série mensal (12 meses): **compras** (fluxo de caixa por `data_compra`) e **consumo** (encerrados por `data_fim`).
- **Custo médio por pessoa (geral)** = Σ `valor_total` dos lotes encerrados ÷ Σ `pessoas_atendidas`.

---

## 4. Métricas

| Métrica | Fórmula |
|---|---|
| Custo/pessoa por produto | Σ `valor_total` (lotes **encerrados**) ÷ Σ `pessoas_atendidas` |
| Pessoas por unidade | Σ `pessoas_atendidas` ÷ Σ `quantidade` (encerrados) |
| Custo/pessoa geral | Σ `valor_total` (encerrados) ÷ Σ `pessoas_atendidas` |
| Gasto mensal (compras) | Σ `valor_total` por mês de `data_compra` |
| Consumo mensal | Σ `valor_total` por mês de `data_fim` dos encerrados |
| Estoque ativo | Compras sem encerramento (lista + quantidade) |

> `pessoas_atendidas` é calculada no momento do encerramento a partir dos atendimentos `CONCLUIDO`
> desde a `data_compra` do lote — o admin **não preenche** esse número.

---

## 5. Frontend (Next.js)

- **LP**: mesmo layout do BarberApp, recolorido (rose), serviços com categoria, envs de nome/whatsapp/tagline.
- **`/agendar`** (5 passos, mobile-first): dia → serviço → horário → dados (nome, WhatsApp, e-mail, CPF com validação) → **Pix 50%** (QR `data:` + copiar copia-e-cola + polling até `PAGO`).
- **`/meus-agendamentos`**: status do sinal + link/QR do Pix se pendente.
- **Admin** abas: `Agenda` (chip de sinal + cancelar) · `Serviços` · `Disponibilidade` · `Produtos` · `Gastos` · `Dashboard`.
  - Produtos: cadastrar produto, lançar compra, listar, **encerrar lote** (só escolhe o lote + data).
  - Gastos: lançar/editar/excluir despesa.
  - Dashboard: cards + barras em CSS puro (sem lib), série mensal, custo/pessoa, top produtos, estoque.

---

## 6. Configuração (.env)

### Backend
```
SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY
ASSAAS_API_URL=https://api-sandbox.asaas.com
ASSAAS_API_KEY=
ASSAAS_WEBHOOK_TOKEN=
GATEWAY_PRIMARY=asaas
SINAL_PERCENTUAL=0.5
SINAL_TTL_MINUTOS=15
JWT_SECRET=
```

### Frontend
```
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SHOP_NAME
NEXT_PUBLIC_SHOP_WHATSAPP
NEXT_PUBLIC_SHOP_TAGLINE
NEXT_PUBLIC_SHOP_ADDRESS
```

> Regra do repo: consultar `node_modules/next/dist/docs/` antes de mexer no Next 16.

---

## 7. Testes (Jest, TDD)

| ID | Módulo | Caso |
|---|---|---|
| UT-01..04 | agendamentos | criação em `AGUARDANDO_SINAL`, `sinal_valor`=50%, expiração libera slot, 409 mantido |
| UT-05 | validação | e-mail/CPF rejeitam entrada inválida |
| UT-06..08 | pagamentos | adapter Asaas mock cria QR; webhook válido → `PAGO`/`CONFIRMADO`; token inválido → 401 |
| UT-09 | pagamentos | cancelamento de sinal cancela no gateway + libera slot |
| UT-10..12 | produtos | custo/pessoa por produto; encerramento único por lote; `pessoas_atendidas` automático |
| UT-13..15 | dashboard | série mensal; custo médio/pessoa; top produtos |
| UT-16..18 | gastos | CRUD + agregação + rota exige token |

---

## 8. Deploy & homologação

- Render (backend) + Vercel (frontend) + Supabase (schema.sql no SQL Editor).
- **Asaas sandbox**: 2 contas — uma com chave Pix gera o QR, outra com saldo paga; webhook aponta para a URL do backend no Render; homologar o fluxo completo; depois trocar para `api.asaas.com` + chave de produção.
- Criar admin: `npm run criar-admin -- maquiadora "senha"`.

---

## 9. Fora de escopo (V2)

Estorno automático, lembrete automático de WhatsApp, multi-profissional, relatório financeiro completo, nota fiscal, registro de consumo por atendimento.