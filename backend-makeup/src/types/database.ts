export type ServicoInsert = {
  nome: string;
  preco: number;
  duracao_minutos: number;
  categoria?: string;
  ativo?: boolean;
};

export type ServicoRow = ServicoInsert & {
  id: string;
  created_at: string;
};

export const AGENDAMENTO_STATUS = [
  'AGUARDANDO_SINAL',
  'CONFIRMADO',
  'CONCLUIDO',
  'CANCELADO',
  'EXPIRADO',
] as const;
export type AgendamentoStatus = (typeof AGENDAMENTO_STATUS)[number];

export const PAGAMENTO_STATUS = [
  'AGUARDANDO',
  'PAGO',
  'EXPIRADO',
  'CANCELADO',
] as const;
export type PagamentoStatus = (typeof PAGAMENTO_STATUS)[number];

export type AgendamentoInsert = {
  cliente_nome: string;
  cliente_whatsapp: string;
  cliente_email?: string | null;
  cliente_cpf?: string | null;
  servico_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  status?: AgendamentoStatus;
  sinal_valor?: number | null;
  sinal_expiracao?: string | null;
  pagamento_status?: PagamentoStatus;
  gateway_payment_id?: string | null;
  gateway_customer_id?: string | null;
  pix_qr_base64?: string | null;
  pix_copia_cola?: string | null;
  pix_expiracao?: string | null;
};

export type AgendamentoRow = AgendamentoInsert & {
  id: string;
  created_at: string;
};

export type BloqueioTipo = 'ALMOCO' | 'FOLGA' | 'IMPREVISTO';

export type BloqueioInsert = {
  data_hora_inicio: string;
  data_hora_fim: string;
  motivo?: string | null;
  recorrente?: boolean;
  dia_semana?: number | null;
  tipo?: BloqueioTipo;
};

export type BloqueioRow = BloqueioInsert & {
  id: string;
  created_at: string;
};

export type ConfigAgendaRow = {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  username: string;
  password_hash: string;
  role: string;
  blocked: boolean | null;
  created_at: string;
};

export type RefreshTokenInsert = {
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked?: boolean;
};

export type RefreshTokenRow = RefreshTokenInsert & {
  id: string;
  created_at: string;
};

export type AgendamentoComServico = AgendamentoRow & {
  servicos?: Pick<
    ServicoRow,
    'id' | 'nome' | 'preco' | 'duracao_minutos' | 'categoria'
  > | null;
};

export type ProdutoInsert = {
  nome: string;
  categoria?: string;
  unidade?: string;
};

export type ProdutoRow = ProdutoInsert & {
  id: string;
  created_at: string;
};

export type CompraInsert = {
  produto_id: string;
  quantidade: number;
  valor_total: number;
  data_compra: string;
  observacao?: string | null;
};

export type CompraRow = CompraInsert & {
  id: string;
  created_at: string;
};

export type CompraComProduto = CompraRow & {
  produtos?: Pick<ProdutoRow, 'id' | 'nome' | 'categoria' | 'unidade'> | null;
  encerramento?: Pick<
    EncerramentoRow,
    'id' | 'pessoas_atendidas' | 'data_fim'
  > | null;
};

export type EncerramentoInsert = {
  compra_id: string;
  pessoas_atendidas: number;
  data_fim: string;
  observacao?: string | null;
};

export type EncerramentoRow = EncerramentoInsert & {
  id: string;
  created_at: string;
};

export type EncerramentoComCompra = EncerramentoRow & {
  compras?: Pick<
    CompraRow,
    'id' | 'produto_id' | 'quantidade' | 'valor_total' | 'data_compra'
  > & {
    produtos?: Pick<ProdutoRow, 'id' | 'nome' | 'categoria' | 'unidade'> | null;
  } | null;
};

export type GastoInsert = {
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
};

export type GastoRow = GastoInsert & {
  id: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      servicos: {
        Row: ServicoRow;
        Insert: ServicoInsert;
        Update: Partial<ServicoInsert>;
        Relationships: [];
      };
      agendamentos: {
        Row: AgendamentoRow;
        Insert: AgendamentoInsert;
        Update: Partial<AgendamentoInsert>;
        Relationships: [
          {
            foreignKeyName: 'agendamentos_servico_id_fkey';
            columns: ['servico_id'];
            referencedRelation: 'servicos';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
      };
      bloqueios: {
        Row: BloqueioRow;
        Insert: BloqueioInsert;
        Update: Partial<BloqueioInsert>;
        Relationships: [];
      };
      admin_users: {
        Row: AdminUserRow;
        Insert: Omit<AdminUserRow, 'id' | 'created_at'>;
        Update: Partial<Omit<AdminUserRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      refresh_tokens: {
        Row: RefreshTokenRow;
        Insert: RefreshTokenInsert;
        Update: Partial<RefreshTokenInsert>;
        Relationships: [
          {
            foreignKeyName: 'refresh_tokens_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'admin_users';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
      };
      produtos: {
        Row: ProdutoRow;
        Insert: ProdutoInsert;
        Update: Partial<ProdutoInsert>;
        Relationships: [];
      };
      compras: {
        Row: CompraRow;
        Insert: CompraInsert;
        Update: Partial<CompraInsert>;
        Relationships: [
          {
            foreignKeyName: 'compras_produto_id_fkey';
            columns: ['produto_id'];
            referencedRelation: 'produtos';
            referencedColumns: ['id'];
            isOneToOne: false;
          },
        ];
      };
      encerramentos: {
        Row: EncerramentoRow;
        Insert: EncerramentoInsert;
        Update: Partial<EncerramentoInsert>;
        Relationships: [
          {
            foreignKeyName: 'encerramentos_compra_id_fkey';
            columns: ['compra_id'];
            referencedRelation: 'compras';
            referencedColumns: ['id'];
            isOneToOne: true;
          },
        ];
      };
      gastos: {
        Row: GastoRow;
        Insert: GastoInsert;
        Update: Partial<GastoInsert>;
        Relationships: [];
      };
      config_agenda: {
        Row: ConfigAgendaRow;
        Insert: ConfigAgendaRow;
        Update: Partial<ConfigAgendaRow>;
        Relationships: [];
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Views: {};
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Functions: {};
  };
};