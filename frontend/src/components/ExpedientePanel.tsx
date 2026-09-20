"use client";

import { useEffect, useState } from "react";
import {
  ExpedienteDia,
  obterExpediente,
  salvarExpediente,
} from "@/lib/api";

const NOMES_DIAS = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sab",
];

const NOMES_DIAS_COMPLETO = [
  "Domingo",
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
];

export default function ExpedientePanel({ token }: { token: string }) {
  const [expediente, setExpediente] = useState<ExpedienteDia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterExpediente(token)
      .then(setExpediente)
      .catch(() => setErro("Erro ao carregar expediente"))
      .finally(() => setCarregando(false));
  }, [token]);

  const getHorario = (dia: number) =>
    expediente.find((e) => e.dia_semana === dia);

  const isAtivo = (dia: number) => getHorario(dia) !== undefined;

  const toggleDia = (dia: number) => {
    setExpediente((prev) => {
      const existe = prev.find((e) => e.dia_semana === dia);
      if (existe) {
        return prev.filter((e) => e.dia_semana !== dia);
      }
      return [
        ...prev,
        { dia_semana: dia, hora_inicio: "08:00", hora_fim: "20:00" },
      ].sort((a, b) => a.dia_semana - b.dia_semana);
    });
  };

  const atualizarHorario = (
    dia: number,
    campo: "hora_inicio" | "hora_fim",
    valor: string,
  ) => {
    setExpediente((prev) =>
      prev.map((e) =>
        e.dia_semana === dia ? { ...e, [campo]: valor } : e,
      ),
    );
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      await salvarExpediente(expediente, token);
      setSucesso("Expediente salvo!");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center text-sm text-zinc-400">
        Carregando expediente...
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-1 text-sm font-semibold text-zinc-400">
        Horario de atendimento
      </h2>
      <p className="mb-4 text-xs text-zinc-500">
        Marque os dias em que voce atende e configure o horario.
      </p>

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

      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4, 5, 6].map((dia) => {
          const horario = getHorario(dia);
          const ativo = horario !== undefined;
          return (
            <div
              key={dia}
              className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 transition sm:gap-3 ${
                ativo
                  ? "border-rose-400 bg-rose-500/10"
                  : "border-zinc-700 bg-zinc-800"
              }`}
            >
              <button
                onClick={() => toggleDia(dia)}
                className={`shrink-0 h-5 w-5 rounded-md border transition ${
                  ativo
                    ? "border-rose-400 bg-rose-500 text-white"
                    : "border-zinc-600 bg-zinc-700"
                } flex items-center justify-center text-xs`}
              >
                {ativo && "\u2713"}
              </button>

              <span
                className={`w-10 text-xs font-semibold ${
                  ativo ? "text-rose-300" : "text-zinc-500"
                }`}
              >
                {NOMES_DIAS[dia]}
              </span>

              {ativo && horario && (
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <input
                    type="time"
                    value={horario.hora_inicio}
                    onChange={(e) =>
                      atualizarHorario(dia, "hora_inicio", e.target.value)
                    }
                    className="rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-rose-400 min-w-0"
                  />
                  <span className="text-xs text-zinc-500">as</span>
                  <input
                    type="time"
                    value={horario.hora_fim}
                    onChange={(e) =>
                      atualizarHorario(dia, "hora_fim", e.target.value)
                    }
                    className="rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-rose-400 min-w-0"
                  />
                </div>
              )}

              {!ativo && (
                <span className="ml-auto text-xs text-zinc-600">
                  nao atende
                </span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSalvar}
        disabled={salvando}
        className="mt-4 w-full rounded-xl border border-rose-400 px-6 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {salvando ? "Salvando..." : "Salvar expediente"}
      </button>
    </section>
  );
}
