"use client";

import { useEffect, useState } from "react";
import {
  Bloqueio,
  TipoBloqueio,
  ExpedienteDia,
  criarBloqueio,
  excluirBloqueio,
  listarBloqueios,
  obterExpediente,
  salvarExpediente,
} from "@/lib/api";
import { formatarHorario, hojeLocal, paraHoraSaoPauloLocal } from "@/lib/horario";
import ConfirmModal from "./ConfirmModal";
import ExpedientePanel from "./ExpedientePanel";

const NOMES_DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const TIPOS: {
  valor: TipoBloqueio;
  rotulo: string;
  descricao: string;
}[] = [
  {
    valor: "ALMOCO",
    rotulo: "Almoço",
    descricao: "Intervalo diário recorrente (ex: 12:00 – 13:00)",
  },
  {
    valor: "FOLGA",
    rotulo: "Folga / sem expediente",
    descricao: "Dia inteiro sem atendimento (ex: um dia da semana recorrente)",
  },
  {
    valor: "IMPREVISTO",
    rotulo: "Imprevisto",
    descricao: "Período pontual em que estará fora",
  },
];

const corTipo: Record<TipoBloqueio, string> = {
  ALMOCO: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  FOLGA: "bg-red-500/15 text-red-300 border-red-500/40",
  IMPREVISTO: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
};

const rotuloTipo: Record<TipoBloqueio, string> = {
  ALMOCO: "Almoço",
  FOLGA: "Folga",
  IMPREVISTO: "Imprevisto",
};

export default function BloqueiosAdmin({ token }: { token: string }) {
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [tipo, setTipo] = useState<TipoBloqueio>("ALMOCO");

  const [data, setData] = useState(hojeLocal());
  const [inicio, setInicio] = useState("12:00");
  const [fim, setFim] = useState("13:00");
  const [motivo, setMotivo] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [diaSemana, setDiaSemana] = useState("1");

  const [excluindo, setExcluindo] = useState<Bloqueio | null>(null);

  const carregar = () => {
    listarBloqueios(token)
      .then(setBloqueios)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
  }, [token]);

  const montarDatas = () => {
    const dataHoraInicio = tipo === "FOLGA"
      ? paraHoraSaoPauloLocal(`${data}T08:00`)
      : paraHoraSaoPauloLocal(`${data}T${inicio}`);
    const dataHoraFim = tipo === "FOLGA"
      ? paraHoraSaoPauloLocal(`${data}T20:00`)
      : paraHoraSaoPauloLocal(`${data}T${fim}`);
    return { dataHoraInicio, dataHoraFim };
  };

  const salvar = async () => {
    setSucesso(null);
    setErro(null);
    if (tipo === "IMPREVISTO" && !data) {
      setErro("Selecione a data.");
      return;
    }
    if (tipo === "ALMOCO" && (!inicio || !fim)) {
      setErro("Informe os horários.");
      return;
    }
    setSalvando(true);
    try {
      const { dataHoraInicio, dataHoraFim } = montarDatas();
      const ehRecorrente =
        tipo === "ALMOCO" ? true : tipo === "FOLGA" ? recorrente : false;
      await criarBloqueio(
        {
          dataHoraInicio,
          dataHoraFim,
          motivo:
            tipo === "ALMOCO"
              ? "Almoço"
              : tipo === "FOLGA"
                ? motivo.trim() || "Folga / sem expediente"
                : motivo.trim() || "Imprevisto",
          recorrente: ehRecorrente,
          dia_semana: ehRecorrente ? Number(diaSemana) : undefined,
          tipo,
        },
        token,
      );
      setSucesso(
        ehRecorrente
          ? `${rotuloTipo[tipo]} recorrente criado para ${NOMES_DIAS[Number(diaSemana)]}.`
          : `${rotuloTipo[tipo]} criado.`,
      );
      setMotivo("");
      setRecorrente(false);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar bloqueio");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    setSucesso(null);
    setErro(null);
    try {
      await excluirBloqueio(id, token);
      setSucesso("Bloqueio removido.");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover bloqueio");
    } finally {
      setExcluindo(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ExpedientePanel token={token} />

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-3 text-sm font-semibold text-zinc-400">
        Bloqueios
      </h2>

      {sucesso && (
        <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {sucesso}
        </div>
      )}
      {erro && (
        <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {erro}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            onClick={() => setTipo(t.valor)}
              className={`rounded-xl border p-3 text-left transition ${
              tipo === t.valor
                ? "border-rose-400 bg-rose-500/10"
                : "border-zinc-700 bg-zinc-800 hover:bg-zinc-800/70"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                tipo === t.valor ? "text-rose-300" : "text-zinc-200"
              }`}
            >
              {t.rotulo}
            </p>
            <p className="text-xs text-zinc-400">{t.descricao}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {tipo === "IMPREVISTO" && (
          <label className="text-xs text-zinc-400">
            Data
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-400"
            />
          </label>
        )}

        {tipo === "ALMOCO" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 text-xs text-zinc-400">
              Início
              <input
                type="time"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="mt-1 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-400"
              />
            </label>
            <label className="min-w-0 text-xs text-zinc-400">
              Fim
              <input
                type="time"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="mt-1 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-400"
              />
            </label>
          </div>
        )}

        {tipo === "IMPREVISTO" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 text-xs text-zinc-400">
              De
              <select
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="mt-1 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-400"
              >
                {gerarHorarios().map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-xs text-zinc-400">
              Até
              <select
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="mt-1 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-400"
              >
                {gerarHorarios().map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {tipo !== "FOLGA" && (
          <>
            {tipo === "ALMOCO" ? (
              <label className="mt-1 block text-xs text-zinc-400">
                Dia da semana (recorrente)
                <select
                  value={diaSemana}
                  onChange={(e) => setDiaSemana(e.target.value)}
                  className="mt-1 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-400"
                >
                  {NOMES_DIAS.map((nome, i) => (
                    <option key={nome} value={i}>
                      {nome}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (ex: dentista, viagem)"
                className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-400"
              />
            )}
          </>
        )}

        {tipo === "FOLGA" && (
          <>
            <label className="text-xs text-zinc-400">
              Data da folga
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-400"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={recorrente}
                onChange={(e) => setRecorrente(e.target.checked)}
                className="h-4 w-4 accent-rose-500"
              />
              Repetir toda semana
            </label>
            {recorrente && (
              <label className="block text-xs text-zinc-400">
                Dia da semana
                <select
                  value={diaSemana}
                  onChange={(e) => setDiaSemana(e.target.value)}
                  className="mt-1 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-400"
                >
                  {NOMES_DIAS.map((nome, i) => (
                    <option key={nome} value={i}>
                      {nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (ex: folga semanal)"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-400"
            />
          </>
        )}

        <button
          onClick={salvar}
          disabled={salvando}
          className="mt-1 w-full rounded-xl border border-rose-400 px-6 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {salvando ? "Salvando..." : "Criar bloqueio"}
        </button>
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-zinc-400">
        Bloqueios ativos
      </h2>
      {carregando ? (
        <p className="py-4 text-center text-sm text-zinc-400">Carregando...</p>
      ) : bloqueios.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-400">
          Nenhum bloqueio cadastrado.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {bloqueios.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 py-3">
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${corTipo[b.tipo] ?? "bg-zinc-500/15 text-zinc-300 border-zinc-500/40"}`}
              >
                {rotuloTipo[b.tipo] ?? "Bloqueio"}
              </span>
              {b.recorrente && b.dia_semana !== null && (
                <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-300">
                  {NOMES_DIAS[b.dia_semana]}
                </span>
              )}
              <div className="min-w-0 flex-1 basis-full sm:basis-0">
                <p className="truncate text-sm font-medium">
                  {b.recorrente ? "" : `${b.data_hora_inicio.slice(0, 10)} · `}
                  {formatarHorario(b.data_hora_inicio)} –{" "}
                  {formatarHorario(b.data_hora_fim)}
                </p>
                {b.motivo && (
                  <p className="truncate text-xs text-zinc-400">{b.motivo}</p>
                )}
              </div>
              <button
                onClick={() => setExcluindo(b)}
                className="shrink-0 rounded-lg border border-red-700 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-900/30"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        aberto={excluindo !== null}
        titulo="Remover bloqueio"
        mensagem={`Tem certeza que deseja remover "${excluindo?.motivo ?? rotuloTipo[excluindo?.tipo ?? "IMPREVISTO"]}"?`}
        confirmarLabel="Remover"
        onConfirmar={() => excluindo && remover(excluindo.id)}
        onCancelar={() => setExcluindo(null)}
      />
      </section>
    </div>
  );
}

function gerarHorarios(): string[] {
  const horarios: string[] = [];
  for (let h = 8; h < 20; h++) {
    horarios.push(`${String(h).padStart(2, "0")}:00`);
    horarios.push(`${String(h).padStart(2, "0")}:30`);
  }
  horarios.push("20:00");
  return horarios;
}