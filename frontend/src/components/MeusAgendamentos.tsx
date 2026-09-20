"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AgendamentoComServico,
  formatarBRL,
  listarMeusAgendamentos,
} from "@/lib/api";
import { formatarDataCurta, formatarHorario } from "@/lib/horario";
import PixSinal from "./PixSinal";

const coresStatus: Record<string, string> = {
  AGUARDANDO_SINAL: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  CONFIRMADO: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  CONCLUIDO: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
  CANCELADO: "bg-red-500/15 text-red-300 border-red-500/40",
  EXPIRADO: "bg-zinc-500/15 text-zinc-400 border-zinc-600/40",
};

const rotuloStatus: Record<string, string> = {
  AGUARDANDO_SINAL: "Aguardando sinal",
  CONFIRMADO: "Confirmado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  EXPIRADO: "Sinal expirado",
};

const rotuloPagamento: Record<string, string> = {
  AGUARDANDO: "Sinal pendente",
  PAGO: "Sinal pago",
  EXPIRADO: "Sinal expirado",
  CANCELADO: "Sinal cancelado",
};

export default function MeusAgendamentos() {
  const [celular, setCelular] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultados, setResultados] = useState<AgendamentoComServico[] | null>(
    null,
  );
  const [pxAberto, setPxAberto] = useState<string | null>(null);
  const [pago, setPago] = useState<string | null>(null);

  const buscar = async () => {
    if (!celular.replace(/\D/g, "")) return;
    setBuscando(true);
    setErro(null);
    setResultados(null);
    setPxAberto(null);
    try {
      const itens = await listarMeusAgendamentos(celular);
      setResultados(itens);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao consultar");
    } finally {
      setBuscando(false);
    }
  };

  return (
    <main className="flex flex-1 justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <header className="flex flex-wrap items-center justify-between gap-y-2 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
              MakeupApp
            </p>
            <h1 className="text-2xl font-bold">Meus agendamentos</h1>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            Voltar
          </Link>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-300">
            Informe o número de celular usado no agendamento para consultar seus
            horários.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              type="tel"
              inputMode="numeric"
              value={celular}
              onChange={(e) => setCelular(e.target.value.replace(/\D/g, "").slice(0, 13))}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              placeholder="(35) 99999-9999"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-rose-500"
            />
            <button
              onClick={buscar}
              disabled={buscando || !celular.replace(/\D/g, "")}
              className="shrink-0 rounded-xl bg-rose-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {buscando ? "Consultando..." : "Consultar"}
            </button>
          </div>

          {erro && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {erro}
            </div>
          )}

          {resultados !== null && resultados.length === 0 && (
            <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
              Nenhum agendamento encontrado para este número.
            </div>
          )}

          {resultados !== null && resultados.length > 0 && (
            <ul className="mt-4 divide-y divide-zinc-800">
              {resultados.map((a) => {
                const sinalPendente =
                  a.status === "AGUARDANDO_SINAL" &&
                  a.pagamento_status === "AGUARDANDO";
                const abrirPix =
                  pxAberto === a.id || (pago === a.id && sinalPendente);
                return (
                  <li key={a.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                          {formatarDataCurta(a.data_hora_inicio.slice(0, 10))}
                        </p>
                        <p className="text-lg font-bold">
                          {formatarHorario(a.data_hora_inicio)}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.servicos?.nome}</p>
                        <p className="text-xs text-zinc-400">
                          {a.servicos?.duracao_minutos} min ·{" "}
                          {a.servicos?.preco !== undefined
                            ? formatarBRL(a.servicos.preco)
                            : ""}
                        </p>
                        {sinalPendente && (
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-rose-400">
                              Sinal: {formatarBRL(a.sinal_valor ?? 0)}
                            </span>
                            <button
                              onClick={() => setPxAberto(pxAberto === a.id ? null : a.id)}
                              className="rounded-md border border-rose-500/50 px-2 py-0.5 font-medium text-rose-300 transition hover:bg-rose-500/10"
                            >
                              {abrirPix ? "Ocultar Pix" : "Ver Pix"}
                            </button>
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          coresStatus[a.status] ?? "bg-zinc-500/15 text-zinc-300 border-zinc-500/40"
                        }`}
                        title={
                          a.pagamento_status
                            ? rotuloPagamento[a.pagamento_status]
                            : undefined
                        }
                      >
                        {rotuloStatus[a.status] ?? a.status}
                      </span>
                    </div>
                    {sinalPendente && abrirPix && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                        <PixSinal
                          agendamentoId={a.id}
                          sinalValor={a.sinal_valor ?? 0}
                          onConfirmado={() => {
                            setPago(a.id);
                            buscar();
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}