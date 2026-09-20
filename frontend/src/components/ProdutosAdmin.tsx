"use client";

import { useEffect, useState } from "react";
import {
  CompraVisao,
  ProdutoResumo,
  atualizarProduto,
  criarCompra,
  criarProduto,
  encerrarCompra,
  excluirProduto as excluirProdutoApi,
  formatarBRL,
  listarCompras,
  listarProdutos,
  removerCompra,
} from "@/lib/api";
import { formatarDataCurta } from "@/lib/horario";
import ConfirmModal from "./ConfirmModal";

export default function ProdutosAdmin({ token }: { token: string }) {
  const [produtos, setProdutos] = useState<ProdutoResumo[]>([]);
  const [compras, setCompras] = useState<CompraVisao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidade, setUnidade] = useState("");

  const [produtoCompra, setProdutoCompra] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");

  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);
  const [encerrarDataFim, setEncerrarDataFim] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [excluindoCompra, setExcluindoCompra] = useState<CompraVisao | null>(null);
  const [excluindoProduto, setExcluindoProduto] = useState<ProdutoResumo | null>(null);

  const carregar = () => {
    Promise.all([listarProdutos(token), listarCompras(token)])
      .then(([p, c]) => {
        setProdutos(p);
        setCompras(c);
      })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
  }, [token]);

  const salvarProduto = async () => {
    setErro(null);
    setSucesso(null);
    if (!nome.trim()) {
      setErro("Informe o nome do produto.");
      return;
    }
    try {
      await criarProduto(
        {
          nome: nome.trim(),
          categoria: categoria.trim() || undefined,
          unidade: unidade.trim() || undefined,
        },
        token,
      );
      setSucesso("Produto cadastrado.");
      setNome("");
      setCategoria("");
      setUnidade("");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao cadastrar produto");
    }
  };

  const salvarCompra = async () => {
    setErro(null);
    setSucesso(null);
    const qtd = Number(quantidade.replace(",", "."));
    const valor = Number(valorTotal.replace(",", "."));
    if (!produtoCompra || !Number.isFinite(qtd) || !Number.isFinite(valor) || !dataCompra) {
      setErro("Preencha produto, quantidade, valor e data.");
      return;
    }
    try {
      await criarCompra(
        {
          produtoId: produtoCompra,
          quantidade: qtd,
          valorTotal: valor,
          dataCompra,
          observacao: observacao.trim() || undefined,
        },
        token,
      );
      setSucesso("Compra lançada.");
      setQuantidade("");
      setValorTotal("");
      setObservacao("");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao lançar compra");
    }
  };

  const confirmarEncerrar = async () => {
    if (!encerrandoId) return;
    setErro(null);
    setSucesso(null);
    try {
      const resultado = await encerrarCompra(
        encerrandoId,
        { dataFim: encerrarDataFim },
        token,
      );
      setSucesso(
        `Lote encerrado: ${resultado.pessoasAtendidas ?? 0} pessoa(s) atendida(s).`,
      );
      setEncerrandoId(null);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao encerrar lote");
      setEncerrandoId(null);
    }
  };

  const excluirCompra = async (id: string) => {
    setErro(null);
    setSucesso(null);
    try {
      await removerCompra(id, token);
      setSucesso("Compra removida.");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover compra");
    } finally {
      setExcluindoCompra(null);
    }
  };

  const excluirProduto = async (id: string) => {
    setErro(null);
    setSucesso(null);
    try {
      await excluirProdutoApi(id, token);
      setSucesso("Produto excluído.");
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir produto");
    } finally {
      setExcluindoProduto(null);
    }
  };

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
          Cadastrar produto
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value.slice(0, 100))}
            placeholder="Nome (ex: Paleta de sombras)"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
          />
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value.slice(0, 50))}
            placeholder="Categoria (ex: Rosto)"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
          />
          <input
            value={unidade}
            onChange={(e) => setUnidade(e.target.value.slice(0, 10))}
            placeholder="Unidade (ex: UN)"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
          />
        </div>
        <button
          onClick={salvarProduto}
          className="mt-3 w-full rounded-xl border border-rose-500 px-6 py-2.5 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10"
        >
          Cadastrar produto
        </button>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          Lançar compra de lote
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">
            Produto
            <select
              value={produtoCompra}
              onChange={(e) => setProdutoCompra(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
            >
              <option value="">Selecione...</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            Unidade / medida
            <input
              value={quantidade}
              onChange={(e) =>
                setQuantidade(e.target.value.replace(/[^0-9,.]/g, "").slice(0, 10))
              }
              inputMode="decimal"
              placeholder="Quantidade (ex: 10)"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
            />
          </label>
          <label className="text-xs text-zinc-400">
            Valor total pago (R$)
            <input
              value={valorTotal}
              onChange={(e) =>
                setValorTotal(e.target.value.replace(/[^0-9,.]/g, "").slice(0, 12))
              }
              inputMode="decimal"
              placeholder="Ex: 150,00"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
            />
          </label>
          <label className="text-xs text-zinc-400">
            Data da compra
            <input
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
            />
          </label>
        </div>
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value.slice(0, 255))}
          placeholder="Observação (opcional)"
          className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
        />
        <button
          onClick={salvarCompra}
          className="mt-3 w-full rounded-xl border border-rose-500 px-6 py-2.5 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10"
        >
          Lançar compra
        </button>
        <p className="mt-2 text-xs text-zinc-500">
          Compras só entram na métrica de custo quando o lote é encerrado.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          Produtos cadastrados
        </h2>
        {carregando ? (
          <p className="py-4 text-center text-sm text-zinc-400">Carregando...</p>
        ) : produtos.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">
            Nenhum produto cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {produtos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {p.nome}
                    {p.categoria && (
                      <span className="ml-1 text-xs font-semibold uppercase tracking-widest text-rose-400">
                        {p.categoria}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {p.lotesAbertos > 0 && `${p.lotesAbertos} lote(s) aberto(s) · `}
                    {p.pessoasAtendidas > 0
                      ? `${p.pessoasAtendidas} atendimento(s)`
                      : "sem atendimentos encerrados"}
                    {p.custoPorPessoa != null &&
                      ` · ${formatarBRL(p.custoPorPessoa)}/pessoa`}
                  </p>
                </div>
                <button
                  onClick={() => setExcluindoProduto(p)}
                  className="rounded-lg border border-red-700 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-900/30"
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          Compras / lotes
        </h2>
        {!carregando && compras.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">
            Nenhuma compra lançada.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {compras.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {c.nome}{" "}
                      <span
                        className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          c.encerrado
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {c.encerrado ? "Encerrado" : "Aberto"}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatarDataCurta(c.dataCompra)} · {c.quantidade}{" "}
                      {c.unidade ?? "UN"} · {formatarBRL(c.valorTotal)}
                      {c.encerrado &&
                        c.pessoasAtendidas != null &&
                        ` · ${c.pessoasAtendidas} atendimento(s)`}
                    </p>
                  </div>
                  {!c.encerrado && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setEncerrandoId(c.id);
                          setEncerrarDataFim(new Date().toISOString().slice(0, 10));
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                      >
                        Encerrar lote
                      </button>
                      <button
                        onClick={() => setExcluindoCompra(c)}
                        className="rounded-lg border border-red-700 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-900/30"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>

                {encerrandoId === c.id && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="mb-2 text-xs text-zinc-400">
                      Ao encerrar, o sistema conta automaticamente os
                      atendimentos concluídos desde a data da compra até a data
                      final escolhida.
                    </p>
                    <label className="mb-2 block text-xs text-zinc-400">
                      Data final do lote
                      <input
                        type="date"
                        value={encerrarDataFim}
                        onChange={(e) => setEncerrarDataFim(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
                      />
                    </label>
                    <button
                      onClick={confirmarEncerrar}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      Confirmar encerramento
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        aberto={excluindoCompra !== null}
        titulo="Excluir compra"
        mensagem={`Excluir a compra de "${excluindoCompra?.nome}"?`}
        confirmarLabel="Excluir"
        onConfirmar={() => excluindoCompra && excluirCompra(excluindoCompra.id)}
        onCancelar={() => setExcluindoCompra(null)}
      />
      <ConfirmModal
        aberto={excluindoProduto !== null}
        titulo="Excluir produto"
        mensagem={`Excluir "${excluindoProduto?.nome}"? Produtos com compras não podem ser excluídos.`}
        confirmarLabel="Excluir"
        onConfirmar={() => excluindoProduto && excluirProduto(excluindoProduto.id)}
        onCancelar={() => setExcluindoProduto(null)}
      />
    </>
  );
}