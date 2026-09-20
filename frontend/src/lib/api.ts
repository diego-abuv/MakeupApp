export interface Servico {
  id: string;
  nome: string;
  preco: number;
  duracao_minutos: number;
  categoria?: string | null;
}

export interface SlotDisponibilidade {
  hora: string;
  disponivel: boolean;
}

export interface ServicoAdmin extends Servico {
  ativo: boolean;
}

export interface AgendamentoComServico {
  id: string;
  cliente_nome: string;
  cliente_whatsapp: string;
  servico_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  status: string;
  pagamento_status?: string | null;
  sinal_valor?: number | null;
  sinal_expiracao?: string | null;
  pix_qr_base64?: string | null;
  pix_copia_cola?: string | null;
  pix_expiracao?: string | null;
  servicos?: {
    nome: string;
    preco: number;
    duracao_minutos: number;
    categoria?: string | null;
  } | null;
}

export interface PixSinal {
  agendamentoId: string;
  sinalValor: number;
  total: number;
  pixQrBase64: string;
  pixCopiaCola: string;
  pixExpiracao: string | null;
}

export interface ProdutoResumo {
  id: string;
  nome: string;
  categoria: string | null;
  unidade: string | null;
  gastoEncerrado: number;
  pessoasAtendidas: number;
  quantidadeEncerrada: number;
  custoPorPessoa: number | null;
  lotesAbertos: number;
}

export interface Produto {
  id: string;
  nome: string;
  categoria: string | null;
  unidade: string | null;
  created_at: string;
}

export interface CompraVisao {
  id: string;
  produtoId: string;
  nome: string;
  categoria: string | null;
  unidade: string | null;
  quantidade: number;
  valorTotal: number;
  dataCompra: string;
  observacao: string | null;
  encerrado: boolean;
  pessoasAtendidas: number | null;
  dataFim: string | null;
}

export interface Gasto {
  id: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  created_at: string;
}

export interface DashboardResumo {
  resumoProdutos: ProdutoResumo[];
  custoMedioPessoa: number | null;
  totalPessoasAtendidas: number;
  totalGastoComprasEncerradas: number;
  totalGastoExtras: number;
  totalLotesAbertos: number;
  estoqueAtivo: Array<{
    compraId: string;
    nome: string;
    quantidade: number;
    unidade: string | null;
    dataCompra: string;
  }>;
  topProdutos: Array<{
    nome: string;
    gastoEncerrado: number;
    custoPorPessoa: number | null;
    pessoasAtendidas: number;
  }>;
  serieMensal: Array<{
    mes: string;
    compras: number;
    consumo: number;
    extras: number;
    pessoas: number;
  }>;
}

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export const SHOP_WHATSAPP =
  process.env.NEXT_PUBLIC_SHOP_WHATSAPP ?? "5535999999999";

export const formatarBRL = (valor: number): string =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let mensagem = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.message === "string") {
        mensagem = body.message;
      } else if (Array.isArray(body.message)) {
        mensagem = body.message
          .map((m: unknown) =>
            typeof m === "string" ? m : (m as { message?: string })?.message ?? "",
          )
          .filter(Boolean)
          .join("; ");
      }
    } catch {
      // corpo não-JSON: mantém mensagem padrão
    }
    throw new Error(mensagem);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function listarServicos(): Promise<Servico[]> {
  const res = await fetch(`${API_URL}/servicos`, { cache: "no-store" });
  return handleResponse(res);
}

export async function listarTodosServicos(
  token: string,
): Promise<ServicoAdmin[]> {
  const res = await fetch(`${API_URL}/servicos/todos`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function criarServico(
  payload: {
    nome: string;
    preco: number;
    duracao_minutos: number;
    categoria?: string;
  },
  token: string,
): Promise<ServicoAdmin> {
  const res = await fetch(`${API_URL}/servicos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function atualizarServico(
  id: string,
  payload: {
    nome?: string;
    preco?: number;
    duracao_minutos?: number;
    ativo?: boolean;
    categoria?: string;
  },
  token: string,
): Promise<ServicoAdmin> {
  const res = await fetch(`${API_URL}/servicos/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function excluirServico(
  id: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/servicos/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

export async function obterHorariosDisponiveis(
  servicoId: string,
  data: string,
): Promise<SlotDisponibilidade[]> {
  const res = await fetch(
    `${API_URL}/agendamentos/disponiveis?servicoId=${servicoId}&data=${data}`,
    { cache: "no-store" },
  );
  return handleResponse(res);
}

export async function criarAgendamento(payload: {
  clienteNome: string;
  clienteWhatsapp: string;
  clienteEmail: string;
  clienteCpf: string;
  servicoId: string;
  dataHoraInicio: string;
}): Promise<AgendamentoComServico> {
  const res = await fetch(`${API_URL}/agendamentos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function gerarPix(agendamentoId: string): Promise<PixSinal> {
  const res = await fetch(`${API_URL}/agendamentos/${agendamentoId}/pix`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse(res);
}

export async function obterPix(agendamentoId: string): Promise<PixSinal> {
  const res = await fetch(`${API_URL}/agendamentos/${agendamentoId}/pix`, {
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function obterStatusSinal(agendamentoId: string): Promise<{
  status: string;
  pagamentoStatus: string;
}> {
  const res = await fetch(`${API_URL}/agendamentos/${agendamentoId}/sinal-status`, {
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function cancelarSinalAgendamento(
  agendamentoId: string,
  token: string,
): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/agendamentos/${agendamentoId}/cancelar-sinal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  return handleResponse(res);
}

export async function listarAgenda(
  data: string,
  token: string,
): Promise<AgendamentoComServico[]> {
  const res = await fetch(`${API_URL}/agendamentos?data=${data}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function atualizarStatus(
  id: string,
  status: "CONCLUIDO" | "CANCELADO",
  token: string,
): Promise<unknown> {
  const res = await fetch(`${API_URL}/agendamentos/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
}

export type TipoBloqueio = "ALMOCO" | "FOLGA" | "IMPREVISTO";

export async function criarBloqueio(
  payload: {
    dataHoraInicio: string;
    dataHoraFim: string;
    motivo?: string;
    recorrente?: boolean;
    dia_semana?: number;
    tipo?: TipoBloqueio;
  },
  token: string,
): Promise<unknown> {
  const res = await fetch(`${API_URL}/bloqueios`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export interface Bloqueio {
  id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  motivo: string | null;
  recorrente: boolean;
  dia_semana: number | null;
  tipo: TipoBloqueio;
}

export async function listarBloqueios(
  token: string,
): Promise<Bloqueio[]> {
  const res = await fetch(`${API_URL}/bloqueios`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function excluirBloqueio(
  id: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/bloqueios/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

export async function loginAdmin(
  username: string,
  password: string,
): Promise<{ access_token: string }> {
  const res = await fetch(`/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res);
}

export async function logoutAdmin(): Promise<unknown> {
  const res = await fetch(`/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(res);
}

export async function restaurarSessao(): Promise<{ access_token: string }> {
  const res = await fetch(`/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  return handleResponse(res);
}

export async function listarMeusAgendamentos(
  whatsapp: string,
): Promise<AgendamentoComServico[]> {
  const apenasDigitos = whatsapp.replace(/\D/g, "");
  const res = await fetch(
    `${API_URL}/agendamentos/meus?whatsapp=${encodeURIComponent(apenasDigitos)}`,
    { cache: "no-store" },
  );
  return handleResponse(res);
}

export async function listarProdutos(
  token: string,
): Promise<ProdutoResumo[]> {
  const res = await fetch(`${API_URL}/produtos`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function criarProduto(
  payload: { nome: string; categoria?: string; unidade?: string },
  token: string,
): Promise<Produto> {
  const res = await fetch(`${API_URL}/produtos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function atualizarProduto(
  id: string,
  payload: { nome?: string; categoria?: string; unidade?: string },
  token: string,
): Promise<Produto> {
  const res = await fetch(`${API_URL}/produtos/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function excluirProduto(
  id: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/produtos/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

export async function listarCompras(
  token: string,
): Promise<CompraVisao[]> {
  const res = await fetch(`${API_URL}/compras`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function criarCompra(
  payload: {
    produtoId: string;
    quantidade: number;
    valorTotal: number;
    dataCompra: string;
    observacao?: string;
  },
  token: string,
): Promise<CompraVisao> {
  const res = await fetch(`${API_URL}/compras`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function encerrarCompra(
  id: string,
  payload: { dataFim: string; observacao?: string },
  token: string,
): Promise<CompraVisao> {
  const res = await fetch(`${API_URL}/compras/${id}/encerrar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function removerCompra(
  id: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/compras/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

export async function listarGastos(token: string): Promise<Gasto[]> {
  const res = await fetch(`${API_URL}/gastos`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function criarGasto(
  payload: { categoria: string; descricao: string; valor: number; data: string },
  token: string,
): Promise<Gasto> {
  const res = await fetch(`${API_URL}/gastos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function removerGasto(id: string, token: string): Promise<void> {
  const res = await fetch(`${API_URL}/gastos/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(res);
}

export async function obterDashboard(token: string): Promise<DashboardResumo> {
  const res = await fetch(`${API_URL}/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse(res);
}

export function montarLinkWhatsApp(params: {
  servico: string;
  data: string;
  hora: string;
  nome: string;
  whatsapp: string;
}): string {
  const texto =
    `Olá! Gostaria de confirmar meu agendamento:\n` +
    `*Serviço:* ${params.servico}\n` +
    `*Data:* ${params.data}\n` +
    `*Horário:* ${params.hora}\n` +
    `*Nome:* ${params.nome}\n` +
    `*WhatsApp:* ${params.whatsapp}`;
  return `https://wa.me/${SHOP_WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

export interface ExpedienteDia {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

export async function obterExpediente(token: string): Promise<ExpedienteDia[]> {
  const res = await fetch(`${API_URL}/config-agenda`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return handleResponse(res);
}

export async function salvarExpediente(
  expediente: ExpedienteDia[],
  token: string,
): Promise<ExpedienteDia[]> {
  const res = await fetch(`${API_URL}/config-agenda`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ expediente }),
  });
  return handleResponse(res);
}

export async function obterExpedientePublico(): Promise<ExpedienteDia[]> {
  const res = await fetch(`${API_URL}/config-agenda`, { cache: "no-store" });
  return handleResponse(res);
}