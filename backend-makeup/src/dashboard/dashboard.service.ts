import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { formatInTimeZone } from 'date-fns-tz';
import { SUPABASE_CLIENT } from '../supabase/supabase.provider';
import { Database } from '../types/database';
import { ProdutosService, ProdutoResumo } from '../produtos/produtos.service';
import { FUSO_HORARIO } from '../horario.config';

export interface MesSerie {
  mes: string;
  compras: number;
  consumo: number;
  extras: number;
  pessoas: number;
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
  topProdutos: Array<Pick<ProdutoResumo, 'nome' | 'gastoEncerrado' | 'custoPorPessoa' | 'pessoasAtendidas'>>;
  serieMensal: MesSerie[];
}

interface LinhaEncerradaComCompra {
  data_fim: string;
  compras?: { valor_total: number } | null;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
    private readonly produtosService: ProdutosService,
  ) {}

  private arredondar(valor: number): number {
    return Number(valor.toFixed(2));
  }

  private atualParaoMes(): Date {
    const agora = new Date();
    return new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1),
    );
  }

  private janela12Meses(): { inicio: string; fim: string; meses: string[] } {
    const hoje = new Date();
    const ultimo = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1);
    const primeiroMes = new Date(ultimo);
    primeiroMes.setUTCMonth(primeiroMes.getUTCMonth() - 11);

    const inicio = `${primeiroMes.toISOString().slice(0, 8)}01`;
    const fim = hoje.toISOString().slice(0, 10);

    const meses: string[] = [];
    const cursor = new Date(primeiroMes);
    for (let i = 0; i < 12; i++) {
      meses.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return { inicio, fim, meses };
  }

  private chaveMesLocal(iso: string): string {
    return formatInTimeZone(new Date(iso), FUSO_HORARIO, 'yyyy-MM');
  }

  private criarBaseSerie(meses: string[]): MesSerie[] {
    return meses.map((mes) => ({
      mes,
      compras: 0,
      consumo: 0,
      extras: 0,
      pessoas: 0,
    }));
  }

  private somarNaSerie(
    serie: MesSerie[],
    chave: string,
    campo: 'compras' | 'consumo' | 'extras' | 'pessoas',
    valor: number,
  ): void {
    const item = serie.find((s) => s.mes === chave);
    if (item) item[campo] = this.arredondar(item[campo] + valor);
  }

  async resumo(): Promise<DashboardResumo> {
    const { inicio, fim, meses } = this.janela12Meses();
    const serie = this.criarBaseSerie(meses);

    const [linhasCompras, linhasEncerramentos, linhasGastos, linhasAgendamentos] =
      await Promise.all([
        this.supabase
          .from('compras')
          .select('valor_total, data_compra')
          .gte('data_compra', inicio)
          .lte('data_compra', fim),
        this.supabase
          .from('encerramentos')
          .select('id, data_fim, compras(valor_total)')
          .gte('data_fim', inicio)
          .lte('data_fim', fim),
        this.supabase
          .from('gastos')
          .select('valor, data')
          .gte('data', inicio)
          .lte('data', fim),
        this.supabase
          .from('agendamentos')
          .select('data_hora_inicio')
          .eq('status', 'CONCLUIDO')
          .gte('data_hora_inicio', `${inicio}T00:00:00.000Z`)
          .lte('data_hora_inicio', `${fim}T23:59:59.000Z`),
      ]);

    const erros = [linhasCompras, linhasEncerramentos, linhasGastos, linhasAgendamentos].filter(
      (l) => l.error,
    );
    if (erros.length > 0) {
      this.logger.error(
        `Erro ao montar série mensal: ${erros.map((e) => `${e.error?.code}:${e.error?.message}`).join(' | ')}`,
      );
      throw new Error('Erro ao montar o dashboard');
    }

    for (const linha of linhasCompras.data ?? []) {
      this.somarNaSerie(serie, linha.data_compra.slice(0, 7), 'compras', Number(linha.valor_total));
    }

    for (const linha of (linhasEncerramentos.data ?? []) as LinhaEncerradaComCompra[]) {
      const valor = Number(linha.compras?.valor_total ?? 0);
      this.somarNaSerie(serie, linha.data_fim.slice(0, 7), 'consumo', valor);
    }

    for (const linha of linhasGastos.data ?? []) {
      this.somarNaSerie(serie, linha.data.slice(0, 7), 'extras', Number(linha.valor));
    }

    for (const linha of linhasAgendamentos.data ?? []) {
      this.somarNaSerie(serie, this.chaveMesLocal(linha.data_hora_inicio), 'pessoas', 1);
    }

    const resumoProdutos = await this.produtosService.listarProdutos();

    const totalGastoComprasEncerradas = this.arredondar(
      resumoProdutos.reduce((acc, p) => acc + p.gastoEncerrado, 0),
    );
    const totalPessoasAtendidas = resumoProdutos.reduce(
      (acc, p) => acc + p.pessoasAtendidas,
      0,
    );
    const totalLotesAbertos = resumoProdutos.reduce(
      (acc, p) => acc + p.lotesAbertos,
      0,
    );

    const comprasComEncerramento = await this.produtosService.listarCompras();
    const estoqueAtivo = comprasComEncerramento
      .filter((c) => !c.encerrado)
      .map((c) => ({
        compraId: c.id,
        nome: c.nome,
        quantidade: c.quantidade,
        unidade: c.unidade,
        dataCompra: c.dataCompra,
      }));

    const topProdutos = [...resumoProdutos]
      .sort((a, b) => b.gastoEncerrado - a.gastoEncerrado)
      .slice(0, 5)
      .map((p) => ({
        nome: p.nome,
        gastoEncerrado: p.gastoEncerrado,
        custoPorPessoa: p.custoPorPessoa,
        pessoasAtendidas: p.pessoasAtendidas,
      }));

    return {
      resumoProdutos,
      custoMedioPessoa:
        totalPessoasAtendidas > 0
          ? this.arredondar(totalGastoComprasEncerradas / totalPessoasAtendidas)
          : null,
      totalPessoasAtendidas,
      totalGastoComprasEncerradas,
      totalGastoExtras: this.arredondar(
        (linhasGastos.data ?? []).reduce((acc, l) => acc + Number(l.valor), 0),
      ),
      totalLotesAbertos,
      estoqueAtivo,
      topProdutos,
      serieMensal: serie,
    };
  }
}