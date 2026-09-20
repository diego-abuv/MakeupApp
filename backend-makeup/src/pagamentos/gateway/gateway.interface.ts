export interface PagadorGateway {
  nome: string;
  whatsapp: string;
  email: string;
  cpf: string;
}

export interface CriarCobrancaInput {
  valor: number;
  vencimento: string;
  idExterno: string;
  pagador: PagadorGateway;
}

export interface CobrancaCriada {
  gatewayPaymentId: string;
  gatewayCustomerId: string;
  qrBase64: string;
  copiaECola: string;
  expiraEm: string;
}

export interface GatewayPagamento {
  criaCobranca(input: CriarCobrancaInput): Promise<CobrancaCriada>;
  cancelaCobranca(gatewayPaymentId: string): Promise<void>;
}

export const GATEWAY_PAGAMENTO = Symbol('GATEWAY_PAGAMENTO');