"use client";

import { useEffect, useState } from "react";
import {
  AgendamentoComServico,
  Servico,
  atualizarStatus,
  cancelarSinalAgendamento,
  formatarBRL,
  listarAgenda,
  listarServicos,
} from "@/lib/api";
import { formatarHorario, hojeLocal } from "@/lib/horario";

interface AgendaCarregada {
  data: string;
  itens: AgendamentoComServico[];
  erro: string | null;
}

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

const coresPagamento: Record<string, string> = {
  AGUARDANDO: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  PAGO: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  EXPIRADO: "bg-zinc-500/15 text-zinc-400 border-zinc-600/40",
  CANCELADO: "bg-red-500/15 text-red-300 border-red-500/40",
};

export default function AdminAgenda({ token }: { token: string }) {
  const [data, setData] = useState(hojeLocal());
  const [versao, setVersao] = useState(0);
  const [agenda, setAgenda] = useState<AgendaCarregada>({
    data: hojeLocal(),
    itens: [],
    erro: null,
  });
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroServico, setFiltroServico] = useState("TODOS");

  const carregando = agenda.data !== data;

  useEffect(() => {
    listarServicos()
      .then(setServicos)
      .catch(() => setServicos([]));
  }, []);

  useEffect(() => {
    let cancelado = false;
    listarAgenda(data, token)
      .then((itens) => {
        if (cancelado) return;
        setAgenda({ data, itens, erro: null });
      })
      .catch((e: Error) => {
        if (cancelado) return;
        setAgenda({ data, itens: [], erro: e.message });
      });
    return () => {
      cancelado = true;
    };
  }, [data, versao, token]);

  const mudarStatus = async (
    id: string,
    status: "CONCLUIDO" | "CANCELADO",
  ) => {
    setSucesso(null);
    try {
      await atualizarStatus(id, status, token);
      setSucesso("Status atualizado.");
      setVersao((v) => v + 1);
    } catch (e) {
      setAgenda((prev) => ({
        ...prev,
        erro: e instanceof Error ? e.message : "Erro ao atualizar status",
      }));
    }
  };

  const cancelarSinal = async (id: string) => {
    setSucesso(null);
    try {
      await cancelarSinalAgendamento(id, token);
      setSucesso("Sinal cancelado e agendamento liberado.");
      setVersao((v) => v + 1);
    } catch (e) {
      setAgenda((prev) => ({
        ...prev,
        erro: e instanceof Error ? e.message : "Erro ao cancelar sinal",
      }));
    }
  };

  const erro = agenda.data === data ? agenda.erro : null;
  const itens = agenda.data === data ? agenda.itens : [];

  const indicadores = {
    total: itens.length,
    confirmados: itens.filter((a) => a.status === "CONFIRMADO").length,
    concluidos: itens.filter((a) => a.status === "CONCLUIDO").length,
    cancelados: itens.filter((a) => a.status === "CANCELADO").length,
  };

  const itensFiltrados = itens.filter(
    (a) =>
      (filtroStatus === "TODOS" || a.status === filtroStatus) &&
      (filtroServico === "TODOS" || a.servico_id === filtroServico),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none transition focus:border-rose-500"
        />
        <button
          onClick={() => setData(hojeLocal())}
          disabled={data === hojeLocal()}
          className="shrink-0 rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Hoje
        </button>
      </div>

      {sucesso && (
        <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {sucesso}
        </div>
      )}
      {erro && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </div>
      )}

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Total</p>
          <p className="mt-1 text-2xl font-bold">{indicadores.total}</p>
        </div>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4">
          <p className="text-xs uppercase tracking-widest text-rose-400">
            Aguardando sinal
          </p>
          <p className="mt-1 text-2xl font-bold">
            {itens.filter((a) => a.status === "AGUARDANDO_SINAL").length}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-widest text-emerald-400">
            Confirmados
          </p>
          <p className="mt-1 text-2xl font-bold">{indicadores.confirmados}</p>
        </div>
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Concluídos
          </p>
          <p className="mt-1 text-2xl font-bold">{indicadores.concluidos}</p>
        </div>
      </section>

      <section className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-xs text-zinc-400">
          Status
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
          >
            <option value="TODOS">Todos</option>
            <option value="AGUARDANDO_SINAL">Aguardando sinal</option>
            <option value="CONFIRMADO">Confirmados</option>
            <option value="CONCLUIDO">Concluídos</option>
            <option value="CANCELADO">Cancelados</option>
          </select>
        </label>
        <label className="flex-1 text-xs text-zinc-400">
          Serviço
          <select
            value={filtroServico}
            onChange={(e) => setFiltroServico(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
          >
            <option value="TODOS">Todos os serviços</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900">
        {carregando ? (
          <p className="p-6 text-center text-sm text-zinc-400">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-400">
            Nenhum agendamento neste dia.
          </p>
        ) : itensFiltrados.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-400">
            Nenhum agendamento com os filtros selecionados.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {itensFiltrados.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-lg font-bold">
                      {formatarHorario(a.data_hora_inicio)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.cliente_nome}</p>
                    <p className="truncate text-xs text-zinc-400">
                      {a.servicos?.nome} · {a.cliente_whatsapp}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <a
                        href={`https://wa.me/${a.cliente_whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 transition hover:text-emerald-300"
                      >
                        WhatsApp do cliente
                      </a>
                      {a.sinal_valor != null && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            coresPagamento[a.pagamento_status ?? "AGUARDANDO"] ??
                            "bg-zinc-500/15 text-zinc-300 border-zinc-500/40"
                          }`}
                        >
                          Sinal {formatarBRL(a.sinal_valor)} ·{" "}
                          {a.pagamento_status ?? "AGUARDANDO"}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      coresStatus[a.status] ?? "bg-zinc-500/15 text-zinc-300 border-zinc-500/40"
                    }`}
                  >
                    {rotuloStatus[a.status] ?? a.status}
                  </span>
                </div>
                {a.status === "AGUARDANDO_SINAL" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => cancelarSinal(a.id)}
                      className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
                    >
                      Cancelar sinal e liberar horário
                    </button>
                  </div>
                )}
                {a.status === "CONFIRMADO" && (
                  <div className="flex gap-2 sm:w-auto">
                    <button
                      onClick={() => mudarStatus(a.id, "CONCLUIDO")}
                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                    >
                      Concluir
                    </button>
                    <button
                      onClick={() => mudarStatus(a.id, "CANCELADO")}
                      className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}