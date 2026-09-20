# 💈 BarberApp V1 — Documento de Especificação & Plano TDD

> **Versão:** 1.0.0 (MVP)
> **Status:** Pronto para Desenvolvimento
> **Arquitetura Base:** NestJS (Backend) + Supabase (PostgreSQL) + Next.js / Tailwind CSS (Frontend)

---

## 1. Visão Geral e Contexto do Projeto

O **BarberApp V1** é um sistema web responsivo e leve criado para automatizar o agendamento de atendimentos de uma barbearia local. O objetivo principal é **eliminar o controle manual via mensagens de WhatsApp**, permitindo que os clientes consultem a agenda e marquem seus horários em poucos cliques, sem necessidade de baixar aplicativos ou realizar cadastros complexos.

### 1.1 Objetivos Estratégicos

- **Para o Cliente:** Experiência mobile rápida (3 cliques), exibindo apenas horários reais disponíveis.
- **Para o Barbeiro:** Painel administrativo simples para acompanhar a agenda diária e bloquear horários sem depender do desenvolvedor.
- **Para o Desenvolvedor:** Arquitetura limpa, custo zero de infraestrutura na V1 (usando tiers gratuitos da Vercel + Supabase/Render) e base modular pronta para evoluir para SaaS.

### 1.2 Mapeamento de Escopo (V1 vs Futuro)

| No Escopo (V1 - MVP) | Fora do Escopo (Versões Futuras / V2) |
| :--- | :--- |
| Seleção de serviços com preço e duração | Pagamento online integrado via Pix (Mercado Pago / Asaas) |
| Algoritmo dinâmico de busca de slots livres | Suporte a múltiplos barbeiros e filiais (*Multi-tenant*) |
| Trava automática contra choque de horário (*Double Booking*) | Disparo automatizado de mensagens via API paga da Z-API / Evolution |
| Redirecionamento nativo com mensagem formatada para WhatsApp | App nativo iOS/Android |
| Painel Admin com login/senha no Supabase Auth | Programa de fidelidade e relatórios financeiros complexos |
| Bloqueio manual de horários (almoço / imprevistos) | — |

---

## 2. Requisitos do Sistema

### 2.1 Requisitos Funcionais (RF)

#### Módulo Cliente (Público)

- **RF01 - Listagem de Serviços:** O sistema deve listar todos os serviços ativos (ex: Cabelo, Barba, Combo) exibindo nome, valor (R$) e duração (minutos).
- **RF02 - Consulta de Horários Disponíveis:** Ao selecionar um serviço e uma data, o sistema deve retornar os slots de horário livres calculados dinamicamente com base na duração do serviço.
- **RF03 - Coleta Mínima de Dados:** O sistema deve solicitar apenas **Nome Completo** e **WhatsApp** para registrar o agendamento.
- **RF04 - Confirmação e Redirecionamento:** Após a persistência do agendamento, o sistema deve gerar um link para o WhatsApp do barbeiro com mensagem pré-formatada contendo os dados do atendimento.

#### Módulo Barbeiro (Admin)

- **RF05 - Autenticação Admin:** O barbeiro deve se autenticar via usuário e senha gerenciados pelo Supabase.
- **RF06 - Agenda do Dia:** O painel admin deve listar os agendamentos do dia em ordem cronológica, exibindo status, cliente, serviço e horário.
- **RF07 - Alteração de Status:** O barbeiro deve poder marcar um agendamento como `CONCLUIDO` ou `CANCELADO`.
- **RF08 - Bloqueio de Horário:** O barbeiro deve conseguir criar bloqueios temporários na agenda (ex: intervalo de almoço ou folga).

### 2.2 Requisitos Não Funcionais (RNF)

- **RNF01 - Usabilidade Mobile-First:** A interface pública deve ser 100% otimizada para smartphones (mínimo de digitação e botões de toque amplos).
- **RNF02 - Desempenho do Algoritmo:** O tempo de resposta para cálculo e retorno dos slots livres deve ser inferior a **500 ms**.
- **RNF03 - Integridade da Agenda (Race Conditions):** O sistema deve validar novamente o conflito de horários no banco de dados antes de concluir o `INSERT`, evitando reservas simultâneas do mesmo slot.
- **RNF04 - Baixo Custo de Infraestrutura:** O projeto deve ser capaz de rodar integralmente dentro das faixas gratuitas do Vercel, Supabase e Render.
- **RNF05 - Testabilidade (TDD):** A lógica de negócio no NestJS deve ser desacoplada da infraestrutura para permitir testes unitários em milissegundos sem depender de banco de dados real.

---

## 3. Arquitetura e Modelagem de Dados

### 3.1 DDL da Base de Dados (Supabase / PostgreSQL)

```sql
-- Habilitar extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Serviços
CREATE TABLE servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    duracao_minutos INT NOT NULL, -- ex: 30, 45, 60
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela de Agendamentos
CREATE TABLE agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_nome VARCHAR(100) NOT NULL,
    cliente_whatsapp VARCHAR(20) NOT NULL,
    servico_id UUID REFERENCES servicos(id) ON DELETE RESTRICT,
    data_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_hora_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'CONFIRMADO', -- 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela de Bloqueios na Agenda
CREATE TABLE bloqueios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_hora_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    motivo VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Dados Iniciais (Seed)
INSERT INTO servicos (nome, preco, duracao_minutos) VALUES
('Cabelo', 35.00, 30),
('Barba', 25.00, 30),
('Combo (Cabelo + Barba)', 50.00, 60);
```

### 3.2 Regra Matemática para Colisão de Horários

Dois intervalos de tempo $A = [A_{\text{inicio}}, A_{\text{fim}}]$ e $B = [B_{\text{inicio}}, B_{\text{fim}}]$ colidem se, e somente se:

$$
A_{\text{inicio}} < B_{\text{fim}} \quad \text{AND} \quad A_{\text{fim}} > B_{\text{inicio}}
$$

---

## 4. Plano de Desenvolvimento Guiado por Testes (TDD)

O fluxo TDD seguirá o ciclo **Red → Green → Refactor**:

1. **Red:** Escrever o teste para a regra de negócio no NestJS (Jest) e verificar a falha.
2. **Green:** Escrever o código mínimo necessário no Service/Controller para passar o teste.
3. **Refactor:** Limpar o código mantendo a suíte de testes rodando em 100% de sucesso.

### 4.1 Especificação dos Casos de Teste (Unitários e Integração)

| ID do Teste | Módulo | Descrição do Teste | Entrada (Payload) | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| UT-01 | AgendamentosService | Deve gerar os slots em intervalos de 30 minutos em um dia sem agendamentos. | Expediente: 09:00 às 11:00. Serviço: 30 min. | Slots: `["09:00", "09:30", "10:00", "10:30"]`. |
| UT-02 | AgendamentosService | Deve remover slots que colidem com um agendamento pré-existente. | Agendamento: 09:30 às 10:00. Serviço: 30 min. | Slots: `["09:00", "10:00", "10:30"]` (09:30 removido). |
| UT-03 | AgendamentosService | Deve filtrar slots onde o serviço de maior duração invade agendamento posterior. | Agendamento: 10:00 às 10:30. Serviço desejado: Combo (60 min). | Slot 09:30 deve ser removido pois terminaria às 10:30. |
| UT-04 | AgendamentosService | Deve remover slots que colidem com bloqueios manuais (almoço). | Bloqueio: 12:00 às 13:00. | Nenhum slot de 12:00 até 12:30 deve ser exibido. |
| UT-05 | AgendamentosService | Deve disparar erro `ConflictException` ao tentar criar agendamento sobreposto. | Payload com horário já reservado. | Retornar HTTP status **409 Conflict**. |
| UT-06 | AgendamentosService | Deve disparar erro `BadRequestException` se o serviço não for encontrado. | `servicoId` inválido/inexistente. | Retornar HTTP status **400 Bad Request**. |

### 4.2 Código dos Testes Unitários para NestJS (`agendamentos.service.spec.ts`)

Abaixo está o arquivo de testes Jest estruturado para orientar o desenvolvimento do `AgendamentosService`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AgendamentosService } from './agendamentos.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

// Interface do Mock do Repositório/Supabase
const mockSupabaseClient = {
  from: jest.fn(),
};

describe('AgendamentosService (TDD)', () => {
  let service: AgendamentosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgendamentosService,
        {
          provide: 'SUPABASE_CLIENT',
          useValue: mockSupabaseClient,
        },
      ],
    }).compile();

    service = module.get<AgendamentosService>(AgendamentosService);
    jest.clearAllMocks();
  });

  describe('obterHorariosDisponiveis', () => {
    it('UT-01: deve gerar grade completa de slots quando não houver agendamentos', async () => {
      // Setup Mock
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { duracao_minutos: 30 },
              error: null,
            }),
          };
        }
        if (table === 'agendamentos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }
      });

      const slots = await service.obterHorariosDisponiveis(
        'servico-uuid-1',
        '2026-08-10',
      );

      // Asserção
      expect(slots).toContain('09:00');
      expect(slots).toContain('09:30');
      expect(slots).toContain('10:00');
    });

    it('UT-02 & UT-03: deve ocultar horários que conflitam com agendamentos existentes', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { duracao_minutos: 60 }, // Combo 1h
              error: null,
            }),
          };
        }
        if (table === 'agendamentos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockResolvedValue({
              data: [
                {
                  data_hora_inicio: '2026-08-10T10:00:00.000Z',
                  data_hora_fim: '2026-08-10T10:30:00.000Z',
                },
              ],
              error: null,
            }),
          };
        }
      });

      const slots = await service.obterHorariosDisponiveis(
        'servico-uuid-combo',
        '2026-08-10',
      );

      // Para um serviço de 60 min, o slot das 09:30 terminaria às 10:30,
      // colidindo com o agendamento das 10:00. Logo, 09:30 e 10:00 devem sumir.
      expect(slots).not.toContain('09:30');
      expect(slots).not.toContain('10:00');
      expect(slots).toContain('08:30');
      expect(slots).toContain('10:30');
    });
  });

  describe('criarAgendamento', () => {
    it('UT-05: deve lançar ConflictException se houver colisão de horário no momento da criação', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'servicos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { duracao_minutos: 30 },
            }),
          };
        }
        if (table === 'agendamentos') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            lt: jest.fn().mockReturnThis(),
            gt: jest.fn().mockResolvedValue({
              data: [{ id: 'agendamento-existente-id' }], // Conflito encontrado
            }),
          };
        }
      });

      const dto = {
        clienteNome: 'João Silva',
        clienteWhatsapp: '35999999999',
        servicoId: 'servico-uuid-1',
        dataHoraInicio: '2026-08-10T14:00:00.000Z',
      };

      await expect(service.criarAgendamento(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
```

---

## 5. Passos para Execução do Projeto

### 5.1 Configuração do Supabase

1. Criar projeto no Supabase.
2. Rodar o script DDL da seção 3.1 no SQL Editor.

### 5.2 Setup do NestJS

```bash
nest new backend-barber
cd backend-barber
npm install @supabase/supabase-js @nestjs/config class-validator class-transformer
```

### 5.3 Rodar a Suíte de Testes (TDD)

```bash
npm run test -- --watch
```

### 5.4 Deploy

- **Backend:** NestJS na Vercel ou Render.
- **Frontend:** Next.js / React na Vercel.
