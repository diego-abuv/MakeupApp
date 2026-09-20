"use client";

import { useEffect, useState } from "react";
import {
  Gasto,
  criarGasto,
  formatarBRL,
  listarGastos,
  removerGasto,
} from "@/lib/api";
import { formatarDataCurta } from "@/lib/horario";
import ConfirmModal from "./ConfirmModal";

const CATEGORIAS = [
  { valor: "CURSO", rotulo: "Curso" },
  { valor: "FERRAMENTA", rotulo: "Ferramenta" },
  { valor: "TRANSPORTE", rotulo: "Transporte" },
  { valor: "OUTRO", rotulo: "Outro" },
];

export default function GastosAdmin({ token }: { token: string }) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [categoria, setCategoria] = useState("OUTRO");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [excluindo, setExcluindo] = useState<Gasto | null>(null);

  const carregar = () => {
    listarGastos(token)
      .then(setGastos)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
  }, [token]);

  const salvar = async () => {
    setErro(null);
    setSucesso(null);
    const valorNum = Number(valor.replace(",", "."));
    if (!descricao.trim() || !Number.isFinite(valorNum) || !data) {
      setErro("Preencha descrição, valor e data.");
      return;
    }
    try {
      await criarGasto(
        { categoria, descricao: descricao.trim(), valor: valorNum, data },
        token,
      );
      setSucesso("Gasto lançado.");
      setDescricao("");
      setValor("");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao lançar gasto");
    }
  };

  const excluir = async (id: string) => {
    setErro(null);
    setSucesso(null);
    try {
      await removerGasto(id, token);
      setSucesso("Gasto removido.");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover gasto");
    } finally {
      setExcluindo(null);
    }
  };

  const totalExibido = gastos.reduce((acc, g) => acc + g.valor, 0);

  return (
    <>
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

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          Lançar gasto extra (curso, ferramenta, transporte...)
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">
            Categoria
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            Valor (R$)
            <input
              value={valor}
              onChange={(e) =>
                setValor(e.target.value.replace(/[^0-9,.]/g, "").slice(0, 12))
              }
              inputMode="decimal"
              placeholder="Ex: 80,00"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-zinc-400">
          Descrição
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value.slice(0, 200))}
            placeholder="Ex: Curso de sobrancelha"
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
          />
        </label>
        <label className="mt-3 block text-xs text-zinc-400">
          Data
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
          />
        </label>
        <button
          onClick={salvar}
          className="mt-3 w-full rounded-xl border border-rose-500 px-6 py-2.5 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10"
        >
          Lançar gasto
        </button>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          Gastos registrados
        </h2>
        {carregando ? (
          <p className="py-4 text-center text-sm text-zinc-400">Carregando...</p>
        ) : gastos.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">
            Nenhum gasto lançado.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-zinc-800">
              {gastos.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.descricao}</p>
                    <p className="text-xs text-zinc-400">
                      {formatarDataCurta(g.data)} · {g.categoria}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-rose-400">
                    {formatarBRL(g.valor)}
                  </span>
                  <button
                    onClick={() => setExcluindo(g)}
                    className="rounded-lg border border-red-700 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-900/30"
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>
            <p className="pt-3 text-right text-sm text-zinc-300">
              Total listado:{" "}
              <span className="font-semibold text-rose-400">
                {formatarBRL(totalExibido)}
              </span>
            </p>
          </>
        )}
      </section>

      <ConfirmModal
        aberto={excluindo !== null}
        titulo="Excluir gasto"
        mensagem={`Excluir "${excluindo?.descricao}"?`}
        confirmarLabel="Excluir"
        onConfirmar={() => excluindo && excluir(excluindo.id)}
        onCancelar={() => setExcluindo(null)}
      />
    </>
  );
}