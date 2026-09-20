"use client";

import { useEffect, useState } from "react";
import {
  DashboardResumo,
  formatarBRL,
  obterDashboard,
} from "@/lib/api";
import { formatarDataCurta } from "@/lib/horario";

function rotuloMes(curto: string): string {
  const [ano, mes] = curto.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, 1)).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

export default function DashboardAdmin({ token }: { token: string }) {
  const [dados, setDados] = useState<DashboardResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<3 | 6 | 12>(12);

  useEffect(() => {
    let cancelado = false;
    obterDashboard(token)
      .then((d) => {
        if (cancelado) return;
        setDados(d);
      })
      .catch((e: Error) => {
        if (cancelado) return;
        setErro(e.message);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [token]);

  if (carregando) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-400">
        Carregando dashboard...
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-300">
        {erro ?? "Erro ao carregar dashboard"}
      </div>
    );
  }

  const serieFiltrada = dados.serieMensal.slice(-periodo);
  const maxValor = Math.max(
    ...serieFiltrada.map((m) => Math.max(m.compras, m.consumo, m.extras)),
    1,
  );

  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Custo médio/pessoa
          </p>
          <p className="mt-1 text-2xl font-bold text-rose-400">
            {dados.custoMedioPessoa != null
              ? formatarBRL(dados.custoMedioPessoa)
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Pessoas atendidas
          </p>
          <p className="mt-1 text-2xl font-bold">{dados.totalPessoasAtendidas}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Gasto em compras
          </p>
          <p className="mt-1 text-2xl font-bold text-rose-400">
            {formatarBRL(dados.totalGastoComprasEncerradas)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Gastos extras
          </p>
          <p className="mt-1 text-2xl font-bold">
            {formatarBRL(dados.totalGastoExtras)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Lotes abertos
          </p>
          <p className="mt-1 text-2xl font-bold">{dados.totalLotesAbertos}</p>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-400">
            Evolucao mensal
          </h2>
          <div className="flex gap-1">
            {([3, 6, 12] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  periodo === p
                    ? "bg-rose-500/20 text-rose-300"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {p}m
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const series = serieFiltrada;
          const W = 600;
          const H = 200;
          const padL = 40;
          const padR = 8;
          const padT = 10;
          const padB = 28;
          const plotW = W - padL - padR;
          const plotH = H - padT - padB;
          const n = series.length;
          const step = n > 1 ? plotW / (n - 1) : plotW;

          const toX = (i: number) => padL + i * step;
          const toY = (v: number) => padT + plotH - (v / maxValor) * plotH;

          const pathD = (vals: number[]) =>
            vals.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");

          const comprasPath = pathD(series.map((m) => m.compras));
          const consumoPath = pathD(series.map((m) => m.consumo));

          const ticks = 4;
          const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxValor / ticks) * i));

          return (
            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56" preserveAspectRatio="xMidYMid meet">
                {tickVals.map((tv) => (
                  <g key={tv}>
                    <line x1={padL} y1={toY(tv)} x2={W - padR} y2={toY(tv)} stroke="#27272a" strokeWidth="1" />
                    <text x={padL - 6} y={toY(tv) + 3} textAnchor="end" fontSize="9" fill="#71717a">
                      {tv >= 1000 ? `${(tv / 1000).toFixed(0)}k` : tv}
                    </text>
                  </g>
                ))}
                {series.map((m, i) => (
                  <text key={m.mes} x={toX(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#71717a">
                    {rotuloMes(m.mes)}
                  </text>
                ))}
                <path d={comprasPath} fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinejoin="round" />
                <path d={consumoPath} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinejoin="round" />
                <path d={pathD(series.map((m) => m.extras))} fill="none" stroke="#52525b" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 3" />
                {series.map((m, i) => (
                  <g key={m.mes}>
                    <circle cx={toX(i)} cy={toY(m.compras)} r="3" fill="#a1a1aa" />
                    <circle cx={toX(i)} cy={toY(m.consumo)} r="3" fill="#f43f5e" />
                    <circle cx={toX(i)} cy={toY(m.extras)} r="3" fill="#52525b" />
                  </g>
                ))}
              </svg>
            </div>
          );
        })()}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-zinc-400" /> Compras
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-rose-500" /> Consumo da make
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-zinc-600" style={{ backgroundImage: "repeating-linear-gradient(90deg, #52525b 0 4px, transparent 4px 7px)" }} /> Extras
          </span>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          Estoque ativo (lotes abertos)
        </h2>
        {dados.estoqueAtivo.length === 0 ? (
          <p className="py-2 text-center text-sm text-zinc-500">
            Nenhum lote aberto.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {dados.estoqueAtivo.map((e) => (
              <li key={e.compraId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.nome}</p>
                  <p className="text-xs text-zinc-400">
                    {formatarDataCurta(e.dataCompra)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold">
                  {e.quantidade} {e.unidade ?? "UN"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          Top produtos por custo
        </h2>
        {dados.topProdutos.length === 0 ? (
          <p className="py-2 text-center text-sm text-zinc-500">
            Sem dados de produtos encerrados.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {dados.topProdutos.map((p) => (
              <li key={p.nome} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="text-xs text-zinc-400">
                    {p.pessoasAtendidas} atendimento(s) ·{" "}
                    {p.custoPorPessoa != null
                      ? `${formatarBRL(p.custoPorPessoa)}/pessoa`
                      : "sem métrica"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-rose-400">
                  {formatarBRL(p.gastoEncerrado)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}