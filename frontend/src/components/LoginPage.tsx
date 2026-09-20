"use client";

import { useState } from "react";
import Link from "next/link";
import { loginAdmin } from "@/lib/api";

interface LoginPageProps {
  onLogin: (token: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const entrar = async () => {
    if (!usuario || !password) return;
    setErro(null);
    setCarregando(true);
    try {
      const { access_token } = await loginAdmin(usuario, password);
      onLogin(access_token);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no login");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-400">
            MakeupApp
          </p>
          <h1 className="mt-1 text-2xl font-bold">Acesso restrito</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Entre com sua conta de administrador
          </p>
        </header>

        {erro && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {erro}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void entrar();
          }}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <label className="block text-xs text-zinc-400">
            Usuário
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="off"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value.toLowerCase())}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100 outline-none transition focus:border-rose-400"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100 outline-none transition focus:border-rose-400"
            />
          </label>
          <button
            type="submit"
            disabled={carregando || !usuario || !password}
            className="w-full rounded-xl bg-rose-500 px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link href="/" className="underline hover:text-zinc-300">
            Voltar à página principal
          </Link>
        </p>
      </div>
    </main>
  );
}