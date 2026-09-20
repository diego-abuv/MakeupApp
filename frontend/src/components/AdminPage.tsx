"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logoutAdmin, restaurarSessao } from "@/lib/api";
import LoginPage from "./LoginPage";
import ServicosAdmin from "./ServicosAdmin";
import BloqueiosAdmin from "./BloqueiosAdmin";
import AdminAgenda from "./AdminAgenda";
import ProdutosAdmin from "./ProdutosAdmin";
import GastosAdmin from "./GastosAdmin";
import DashboardAdmin from "./DashboardAdmin";

type Abas =
  | "agenda"
  | "servicos"
  | "bloqueios"
  | "produtos"
  | "gastos"
  | "dashboard";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checando, setChecando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    restaurarSessao()
      .then(({ access_token }) => {
        if (cancelado) return;
        setToken(access_token);
      })
      .catch(() => {
        if (cancelado) return;
        setToken(null);
      })
      .finally(() => {
        if (cancelado) return;
        setChecando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (checando) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-400">
        Verificando sessão...
      </main>
    );
  }

  if (!token) {
    return <LoginPage onLogin={setToken} />;
  }

  return <AdminPainel token={token} onSair={() => setToken(null)} />;
}

function AdminPainel({
  token,
  onSair,
}: {
  token: string;
  onSair: () => void;
}) {
  const [aba, setAba] = useState<Abas>("agenda");

  const abas: Array<{ id: Abas; rotulo: string }> = [
    { id: "agenda", rotulo: "Agenda" },
    { id: "servicos", rotulo: "Serviços" },
    { id: "bloqueios", rotulo: "Disponibilidade" },
    { id: "produtos", rotulo: "Produtos" },
    { id: "gastos", rotulo: "Gastos" },
    { id: "dashboard", rotulo: "Dashboard" },
  ];

  const sair = async () => {
    try {
      await logoutAdmin();
    } finally {
      onSair();
    }
  };

  return (
    <main className="flex flex-1 justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <header className="flex flex-wrap items-center justify-between gap-y-2 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
              Painel
            </p>
            <h1 className="text-2xl font-bold">Administração</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={sair}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Sair
            </button>
            <Link
              href="/"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Página do cliente
            </Link>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {abas.map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                aba === t.id
                  ? "bg-rose-500 text-zinc-950"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {t.rotulo}
            </button>
          ))}
        </div>

        {aba === "servicos" && <ServicosAdmin token={token} />}
        {aba === "bloqueios" && <BloqueiosAdmin token={token} />}
        {aba === "produtos" && <ProdutosAdmin token={token} />}
        {aba === "gastos" && <GastosAdmin token={token} />}
        {aba === "dashboard" && <DashboardAdmin token={token} />}
        {aba === "agenda" && <AdminAgenda token={token} />}
      </div>
    </main>
  );
}