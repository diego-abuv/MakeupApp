"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Servico,
  SlotDisponibilidade,
  ExpedienteDia,
  formatarBRL,
  listarServicos,
  obterHorariosDisponiveis,
  criarAgendamento,
  obterExpedientePublico,
} from "@/lib/api";
import {
  formatarDataExtenso,
  diasDoMes,
  rotuloSemana,
  rotuloMes,
  dataHoraLocal,
  horaJaPassada,
  hojeLocal,
} from "@/lib/horario";
import PixSinal from "./PixSinal";

interface SlotsCarregados {
  chave: string;
  horarios: SlotDisponibilidade[];
  erro: string | null;
}

function formatarCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

const cpfDigitosValidos = (cpf: string): boolean => {
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;
  const calc = (base: number): number => {
    let soma = 0;
    for (let i = 0; i < base; i++) soma += Number(digitos[i]) * (base + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(9) === Number(digitos[9]) && calc(10) === Number(digitos[10]);
};

export default function BookingPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicosCarregados, setServicosCarregados] = useState(false);
  const [data, setData] = useState<string>("");
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotsCarregados | null>(null);
  const [horario, setHorario] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [agendamento, setAgendamento] = useState<{
    id: string;
    servico: string;
    data: string;
    hora: string;
    sinal: number;
  } | null>(null);
  const [pago, setPago] = useState(false);
  const [expediente, setExpediente] = useState<ExpedienteDia[]>([]);

  const hoje = hojeLocal();
  const [ano, mes] = hoje.split("-").map(Number);
  const [mesExibido, setMesExibido] = useState<{ ano: number; mes: number }>({
    ano,
    mes,
  });

  const dias = diasDoMes(mesExibido.ano, mesExibido.mes);
  const primeiroDiaMes = new Date(
    Date.UTC(mesExibido.ano, mesExibido.mes - 1, 1),
  ).getUTCDay();
  const diasAtivos = new Set(expediente.map((e) => e.dia_semana));

  const mudarMes = (delta: number) => {
    const atual = new Date(Date.UTC(mesExibido.ano, mesExibido.mes - 1 + delta, 1));
    setMesExibido({
      ano: atual.getUTCFullYear(),
      mes: atual.getUTCMonth() + 1,
    });
    setData("");
    setServicoId(null);
    setHorario(null);
  };

  useEffect(() => {
    let cancelado = false;
    listarServicos()
      .then((s) => {
        if (cancelado) return;
        setServicos(s);
      })
      .catch((e: Error) => {
        if (cancelado) return;
        setErro(e.message);
      })
      .finally(() => {
        if (!cancelado) setServicosCarregados(true);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    obterExpedientePublico()
      .then(setExpediente)
      .catch(() => {});
  }, []);

  const chaveSlots = servicoId && data ? `${servicoId}|${data}` : null;
  const horarios =
    slots?.chave === chaveSlots
      ? slots.horarios.filter((h) => !horaJaPassada(data, h.hora))
      : [];
  const erroSlots = slots?.chave === chaveSlots ? slots.erro : null;
  const carregandoSlots =
    chaveSlots !== null && slots?.chave !== chaveSlots;

  useEffect(() => {
    if (!chaveSlots) return;
    let cancelado = false;
    obterHorariosDisponiveis(servicoId as string, data)
      .then((hs) => {
        if (cancelado) return;
        setSlots({ chave: chaveSlots, horarios: hs, erro: null });
      })
      .catch((e: Error) => {
        if (cancelado) return;
        setSlots({ chave: chaveSlots, horarios: [], erro: e.message });
      });
    return () => {
      cancelado = true;
    };
  }, [chaveSlots, servicoId, data]);

  const servico = servicos.find((s) => s.id === servicoId) ?? null;

  const confirmar = useCallback(async () => {
    if (!servico || !data || !horario) return;
    setConfirmando(true);
    setErro(null);
    try {
      const dataHoraInicio = dataHoraLocal(data, horario);
      const criado = await criarAgendamento({
        clienteNome: nome,
        clienteWhatsapp: whatsapp,
        clienteEmail: email,
        clienteCpf: cpf,
        servicoId: servico.id,
        dataHoraInicio,
      });
      setAgendamento({
        id: criado.id,
        servico: servico.nome,
        data: formatarDataExtenso(data),
        hora: horario,
        sinal: criado.sinal_valor ?? servico.preco * 0.5,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível agendar");
    } finally {
      setConfirmando(false);
    }
  }, [servico, data, horario, nome, whatsapp, email, cpf]);

  if (pago && agendamento) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600/20 text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold">Sinal confirmado!</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Seu horário está garantido. Enviamos o comprovante ao seu e-mail e
            WhatsApp.
          </p>
          <Link
            href="/meus-agendamentos"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-6 py-4 text-base font-semibold text-zinc-950 transition hover:bg-rose-400"
          >
            Ver meus agendamentos
          </Link>
          <Link
            href="/"
            className="mt-3 block w-full rounded-xl border border-zinc-700 px-6 py-3 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            Voltar à página inicial
          </Link>
        </div>
      </main>
    );
  }

  if (agendamento) {
    return (
      <main className="flex flex-1 justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <nav className="pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-zinc-200"
            >
              ← Voltar para a página inicial
            </Link>
          </nav>
          <header className="py-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
              MakeupApp
            </p>
            <h1 className="mt-1 text-2xl font-bold">Quase lá!</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Pague o sinal para garantir o seu horário.
            </p>
          </header>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <dl className="mb-4 space-y-1 text-sm">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <dt className="text-zinc-500">Serviço</dt>
                <dd className="font-medium">{agendamento.servico}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <dt className="text-zinc-500">Data</dt>
                <dd className="font-medium">{agendamento.data}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <dt className="text-zinc-500">Horário</dt>
                <dd className="font-medium">{agendamento.hora}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <dt className="text-zinc-500">Sinal</dt>
                <dd className="font-semibold text-rose-400">
                  {formatarBRL(agendamento.sinal)}
                </dd>
              </div>
            </dl>
            <PixSinal
              agendamentoId={agendamento.id}
              sinalValor={agendamento.sinal}
              onConfirmado={() => setPago(true)}
            />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg">
        <nav className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            ← Voltar para a página inicial
          </Link>
        </nav>
        <header className="py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
            MakeupApp
          </p>
          <h1 className="mt-1 text-3xl font-bold">Agende seu horário</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Escolha o serviço, o dia e o horário. Garanta com 50% no Pix.
          </p>
        </header>

        {erro && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {erro}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-400">
            1 · Escolha o dia
          </h2>
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => mudarMes(-1)}
              disabled={mesExibido.ano === ano && mesExibido.mes === mes}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Mês anterior"
            >
              ←
            </button>
            <span className="text-sm font-medium text-zinc-200">
              {rotuloMes(mesExibido.ano, mesExibido.mes)}
            </span>
            <button
              onClick={() => mudarMes(1)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
              aria-label="Próximo mês"
            >
              →
            </button>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <span
                key={i}
                className="text-center text-[10px] font-semibold uppercase text-zinc-500"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: primeiroDiaMes }).map((_, i) => (
              <span key={`vazio-${i}`} />
            ))}
            {dias.map((d) => {
              const [, , dia] = d.split("-").map(Number);
              const [a, m, dd] = d.split("-").map(Number);
              const diaSemana = new Date(Date.UTC(a, m - 1, dd)).getUTCDay();
              const ativo = d === data;
              const passado = d < hoje;
              const indisponivel = diasAtivos.size > 0 && !diasAtivos.has(diaSemana);
              const desabilitado = passado || indisponivel;
              return (
                <button
                  key={d}
                  disabled={desabilitado}
                  onClick={() => {
                    setData(d);
                    setServicoId(null);
                    setHorario(null);
                  }}
                  className={`flex min-w-0 flex-col items-center justify-center rounded-lg border py-2 transition ${
                    ativo
                      ? "border-rose-500 bg-rose-500/10"
                      : desabilitado
                        ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-600"
                        : "border-zinc-700 bg-zinc-800 hover:border-zinc-500"
                  }`}
                >
                  <span className="text-[10px] uppercase text-zinc-400">
                    {rotuloSemana(d)}
                  </span>
                  <span className="text-sm font-bold">{dia}</span>
                </button>
              );
            })}
          </div>
        </section>

        {data && (
          <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              2 · Escolha o serviço
            </h2>
            {!servicosCarregados ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                Carregando serviços...
              </p>
            ) : servicos.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                Nenhum serviço disponível.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {servicos.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setServicoId(s.id);
                      setHorario(null);
                    }}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                      servicoId === s.id
                        ? "border-rose-500 bg-rose-500/10"
                        : "border-zinc-700 bg-zinc-800 hover:border-zinc-500"
                    }`}
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
                    <span className="text-sm font-semibold text-rose-400">
                      {formatarBRL(s.preco)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {servico && data && (
          <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              3 · Escolha o horário
            </h2>
            <p className="mb-3 text-xs text-zinc-500">
              {formatarDataExtenso(data)} · horários ocupados aparecem
              esmaecidos
            </p>
            {carregandoSlots ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                Carregando horários...
              </p>
            ) : erroSlots ? (
              <p className="py-4 text-center text-sm text-red-300">
                {erroSlots}
              </p>
            ) : horarios.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                Nenhum horário disponível neste dia.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {horarios.map((h) => {
                  const ocupado = !h.disponivel;
                  return (
                    <button
                      key={h.hora}
                      disabled={ocupado}
                      onClick={() => setHorario(h.hora)}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                        horario === h.hora
                          ? "border-rose-500 bg-rose-500/10 text-rose-300"
                          : ocupado
                            ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-600 line-through"
                            : "border-zinc-700 bg-zinc-800 hover:border-zinc-500"
                      }`}
                    >
                      {h.hora}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {servico && data && horario && (
          <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-400">
              4 · Seus dados
            </h2>

            <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm">
              <p className="text-zinc-400">Resumo do agendamento</p>
              <dl className="mt-2 space-y-1">
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                  <dt className="text-zinc-500">Serviço</dt>
                  <dd className="text-right font-medium">{servico.nome}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                  <dt className="text-zinc-500">Data</dt>
                  <dd className="text-right font-medium">
                    {formatarDataExtenso(data)}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                  <dt className="text-zinc-500">Horário</dt>
                  <dd className="text-right font-medium">{horario}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                  <dt className="text-zinc-500">Valor total</dt>
                  <dd className="text-right font-medium">
                    {formatarBRL(servico.preco)}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                  <dt className="text-zinc-500">Sinal (50%)</dt>
                  <dd className="text-right font-semibold text-rose-400">
                    {formatarBRL(servico.preco * 0.5)}
                  </dd>
                </div>
              </dl>
            </div>

            <label className="mb-1 block text-xs text-zinc-400">
              Nome completo
            </label>
            <input
              value={nome}
              onChange={(e) =>
                setNome(
                  e.target.value.replace(/[^a-zA-ZÀ-ÿ\s']/g, "").slice(0, 100),
                )
              }
              placeholder="Ex: Maria da Silva"
              className="mb-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base outline-none transition focus:border-rose-500"
            />

            <label className="mb-1 block text-xs text-zinc-400">
              WhatsApp (com DDD)
            </label>
            <input
              value={whatsapp}
              onChange={(e) =>
                setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 13))
              }
              inputMode="numeric"
              placeholder="Ex: 35999999999"
              className="mb-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base outline-none transition focus:border-rose-500"
            />

            <label className="mb-1 block text-xs text-zinc-400">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 120))}
              placeholder="Ex: maria@email.com"
              className="mb-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base outline-none transition focus:border-rose-500"
            />

            <label className="mb-1 block text-xs text-zinc-400">CPF</label>
            <input
              value={cpf}
              onChange={(e) => setCpf(formatarCpf(e.target.value))}
              inputMode="numeric"
              placeholder="000.000.000-00"
              className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base outline-none transition focus:border-rose-500"
            />

            <p className="mb-4 text-xs text-zinc-500">
              Ao agendar, você garante o horário pagando o sinal de 50% via Pix.
            </p>

            <button
              onClick={confirmar}
              disabled={
                confirmando ||
                !nome.trim() ||
                whatsapp.length < 10 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
                !cpfDigitosValidos(cpf)
              }
              className="w-full rounded-xl bg-rose-500 px-6 py-4 text-base font-semibold text-zinc-950 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {confirmando ? "Agendando..." : "Ir para o pagamento do sinal"}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}