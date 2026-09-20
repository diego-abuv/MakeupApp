import Link from "next/link";
import { listarServicos, formatarBRL, SHOP_WHATSAPP } from "@/lib/api";

interface Servico {
  id: string;
  nome: string;
  preco: number;
  duracao_minutos: number;
  categoria?: string | null;
}

const TAGLINE = process.env.NEXT_PUBLIC_SHOP_TAGLINE || "Beleza que valoriza";

const PASSOS = [
  {
    titulo: "Escolha o dia",
    descricao:
      "Navegue pelo calendário e veja os dias com horários livres.",
  },
  {
    titulo: "Escolha o serviço",
    descricao:
      "Maquiagem, sobrancelha e mais. Veja valores e duração em segundos.",
  },
  {
    titulo: "Selecione o horário",
    descricao:
      "Confira apenas os horários realmente livres em tempo real.",
  },
  {
    titulo: "Garanta com o sinal",
    descricao:
      "Pague 50% do valor no Pix e garanta o seu horário com apenas um toque.",
  },
];

async function carregarServicos(): Promise<Servico[]> {
  try {
    return await listarServicos();
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const servicos = await carregarServicos();

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
            {TAGLINE}
          </p>
          <p className="text-sm font-bold text-zinc-100">
            {process.env.NEXT_PUBLIC_SHOP_NAME || "MakeupApp Studio"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/meus-agendamentos"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            Meus agendamentos
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            Área do admin
          </Link>
          <Link
            href="/agendar"
            className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-rose-400"
          >
            Agendar horário
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-2xl px-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
          {TAGLINE}
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          Do clássico ao sofisticado
        </h1>
        <p className="mt-3 text-base text-zinc-400">
          Atendimento caprichado, preço justo e agendamento em poucos cliques,
          com sinal de 50% no Pix para garantir o seu horário.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/agendar"
            className="w-full rounded-xl bg-rose-500 px-6 py-4 text-base font-semibold text-zinc-950 transition hover:bg-rose-400 sm:w-auto"
          >
            Agendar meu horário
          </Link>
          <a
            href={`https://wa.me/${SHOP_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl border border-zinc-700 px-6 py-4 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800 sm:w-auto"
          >
            Falar no WhatsApp
          </a>
        </div>
      </section>

      <section className="mx-auto w-full max-w-2xl px-5 pt-12">
        <h2 className="text-left text-2xl font-bold">Serviços</h2>
        <div className="mt-4 flex flex-col gap-3">
          {servicos.length === 0 ? (
            <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center text-sm text-zinc-400">
              Serviços em breve.
            </p>
          ) : (
            servicos.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div>
                  <p className="font-medium">
                    {s.categoria && (
                      <span className="mr-1 text-xs font-semibold uppercase tracking-widest text-rose-400">
                        {s.categoria} ·
                      </span>
                    )}
                    {s.nome}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {s.duracao_minutos} min
                  </p>
                </div>
                <span className="text-base font-semibold text-rose-400">
                  {formatarBRL(s.preco)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-2xl px-5 pt-12">
        <h2 className="text-left text-2xl font-bold">Como funciona</h2>
        <div className="mt-4 flex flex-col gap-3">
          {PASSOS.map((p, i) => (
            <div
              key={p.titulo}
              className="flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-sm font-bold text-rose-400">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{p.titulo}</p>
                <p className="text-sm text-zinc-400">{p.descricao}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-2xl px-5 py-12 text-center">
        <Link
          href="/agendar"
          className="w-full rounded-xl bg-rose-500 px-6 py-4 text-base font-semibold text-zinc-950 transition hover:bg-rose-400"
        >
          Agende já o seu horário
        </Link>
      </section>

      <footer className="border-t border-zinc-800 px-5 py-6 text-center text-sm text-zinc-500">
        <p>Seg a Sáb · 08h às 20h</p>
        <p className="mt-1">
          © {new Date().getFullYear()}{" "}
          {process.env.NEXT_PUBLIC_SHOP_NAME || "MakeupApp Studio"}
        </p>
      </footer>
    </>
  );
}