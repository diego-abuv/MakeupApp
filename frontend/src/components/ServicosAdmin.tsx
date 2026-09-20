"use client";

import { useEffect, useState } from "react";
import {
  ServicoAdmin,
  atualizarServico,
  criarServico,
  excluirServico,
  formatarBRL,
  listarTodosServicos,
} from "@/lib/api";
import ConfirmModal from "./ConfirmModal";

export default function ServicosAdmin({ token }: { token: string }) {
  const [servicos, setServicos] = useState<ServicoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCategoria, setEditCategoria] = useState("");
  const [editPreco, setEditPreco] = useState("");
  const [editDuracao, setEditDuracao] = useState("");

  const [excluindo, setExcluindo] = useState<ServicoAdmin | null>(null);

  const carregar = () => {
    listarTodosServicos(token)
      .then(setServicos)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
  }, [token]);

  const salvar = async () => {
    setSucesso(null);
    setErro(null);
    const precoNum = Number(preco.replace(",", "."));
    const duracaoNum = Number(duracao);
    if (!nome.trim() || !Number.isFinite(precoNum) || !Number.isFinite(duracaoNum)) {
      setErro("Preencha nome, preço e duração corretamente.");
      return;
    }
    setSalvando(true);
    try {
      await criarServico(
        {
          nome: nome.trim(),
          preco: precoNum,
          duracao_minutos: duracaoNum,
          categoria: categoria.trim() || undefined,
        },
        token,
      );
      setSucesso("Serviço criado.");
      setNome("");
      setCategoria("");
      setPreco("");
      setDuracao("");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar serviço");
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (s: ServicoAdmin) => {
    setSucesso(null);
    setErro(null);
    try {
      await atualizarServico(s.id, { ativo: !s.ativo }, token);
      setSucesso(s.ativo ? "Serviço desativado." : "Serviço ativado.");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar serviço");
    }
  };

  const iniciarEdicao = (s: ServicoAdmin) => {
    setEditandoId(s.id);
    setEditNome(s.nome);
    setEditCategoria(s.categoria ?? "");
    setEditPreco(String(s.preco));
    setEditDuracao(String(s.duracao_minutos));
  };

  const confirmarEdicao = async (id: string) => {
    setSucesso(null);
    setErro(null);
    const precoNum = Number(editPreco.replace(",", "."));
    const duracaoNum = Number(editDuracao);
    if (
      !editNome.trim() ||
      !Number.isFinite(precoNum) ||
      !Number.isFinite(duracaoNum)
    ) {
      setErro("Preencha nome, preço e duração corretamente.");
      return;
    }
    setSalvando(true);
    try {
      await atualizarServico(
        id,
        {
          nome: editNome.trim(),
          categoria: editCategoria.trim() || undefined,
          preco: precoNum,
          duracao_minutos: duracaoNum,
        },
        token,
      );
      setSucesso("Serviço atualizado.");
      setEditandoId(null);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar serviço");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string) => {
    setSucesso(null);
    setErro(null);
    try {
      await excluirServico(id, token);
      setSucesso("Serviço excluído.");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir serviço");
    } finally {
      setExcluindo(null);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-3 text-sm font-semibold text-zinc-400">
        Cadastrar serviço
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
  <input
    value={nome}
    onChange={(e) =>
      setNome(e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s-]/g, "").slice(0, 100))
    }
    placeholder="Nome (ex: Maquiagem social)"
    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
  />
  <input
    value={categoria}
    onChange={(e) =>
      setCategoria(e.target.value.slice(0, 50))
    }
    placeholder="Categoria (ex: Rosto)"
    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
  />
  <input
    value={preco}
    onChange={(e) =>
      setPreco(e.target.value.replace(/[^0-9,.]/g, "").slice(0, 10))
    }
    placeholder="Preço (ex: 35,00)"
    inputMode="decimal"
    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
  />
  <input
    value={duracao}
    onChange={(e) => setDuracao(e.target.value.replace(/\D/g, "").slice(0, 4))}
    placeholder="Duração (minutos)"
    inputMode="numeric"
    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
  />
</div>
      <button
        onClick={salvar}
        disabled={salvando}
        className="mt-3 w-full rounded-xl border border-rose-500 px-6 py-2.5 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {salvando ? "Salvando..." : "Cadastrar serviço"}
      </button>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-zinc-400">
        Serviços cadastrados
      </h2>
      {carregando ? (
        <p className="py-4 text-center text-sm text-zinc-400">Carregando...</p>
      ) : servicos.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-400">
          Nenhum serviço cadastrado.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {servicos.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              {editandoId === s.id ? (
                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:flex-1">
                  <input
                    value={editNome}
                    onChange={(e) =>
                      setEditNome(
                        e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s-]/g, "").slice(0, 100),
                      )
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-rose-500"
                  />
                  <input
                    value={editCategoria}
                    onChange={(e) => setEditCategoria(e.target.value.slice(0, 50))}
                    placeholder="Categoria"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-rose-500"
                  />
                  <input
                    value={editPreco}
                    onChange={(e) =>
                      setEditPreco(e.target.value.replace(/[^0-9,.]/g, "").slice(0, 10))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-rose-500"
                  />
                  <input
                    value={editDuracao}
                    onChange={(e) =>
                      setEditDuracao(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:border-rose-500"
                  />
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {s.categoria && (
                      <span className="mr-1 text-xs font-semibold uppercase tracking-widest text-rose-400">
                        {s.categoria} ·
                      </span>
                    )}
                    {s.nome}{" "}
                    <span
                      className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        s.ativo
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : "border-zinc-600 bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {s.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-400">
                    {s.duracao_minutos} min
                  </p>
                </div>
              )}

              {editandoId === s.id ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => confirmarEdicao(s.id)}
                    disabled={salvando}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-rose-400">
                    {formatarBRL(s.preco)}
                  </span>
                  <button
                    onClick={() => iniciarEdicao(s)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => alternarAtivo(s)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
                  >
                    {s.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => setExcluindo(s)}
                    className="rounded-lg border border-red-700 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-900/30"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        aberto={excluindo !== null}
        titulo="Excluir serviço"
        mensagem={`Tem certeza que deseja excluir "${excluindo?.nome}"? Esta ação não pode ser desfeita.`}
        confirmarLabel="Excluir"
        onConfirmar={() => excluindo && excluir(excluindo.id)}
        onCancelar={() => setExcluindo(null)}
      />
    </section>
  );
}
