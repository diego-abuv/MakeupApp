"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PixSinal as PixSinalDados,
  formatarBRL,
  gerarPix,
  obterPix,
  obterStatusSinal,
} from "@/lib/api";

interface Props {
  agendamentoId: string;
  sinalValor?: number;
  onConfirmado?: () => void;
  onExpirado?: () => void;
}

function usarContagem(pixExpiracao: string | null): string {
  const [restante, setRestante] = useState<string>("");

  useEffect(() => {
    if (!pixExpiracao) return;
    const atualizar = () => {
      const diff = new Date(pixExpiracao).getTime() - Date.now();
      if (diff <= 0) {
        setRestante("Expirado");
        return;
      }
      const totalSeg = Math.floor(diff / 1000);
      const min = Math.floor(totalSeg / 60);
      const seg = totalSeg % 60;
      setRestante(
        `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`,
      );
    };
    atualizar();
    const id = setInterval(atualizar, 1000);
    return () => clearInterval(id);
  }, [pixExpiracao]);

  return restante;
}

export default function PixSinal({
  agendamentoId,
  sinalValor,
  onConfirmado,
  onExpirado,
}: Props) {
  const [pix, setPix] = useState<PixSinalDados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [finalizado, setFinalizado] = useState<
    "confirmado" | "expirado" | null
  >(null);

  const buscarPix = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await gerarPix(agendamentoId);
      setPix(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o Pix");
    } finally {
      setCarregando(false);
    }
  }, [agendamentoId]);

  useEffect(() => {
    buscarPix();
  }, [buscarPix]);

  useEffect(() => {
    if (finalizado) return;
    const id = setInterval(async () => {
      try {
        const status = await obterStatusSinal(agendamentoId);
        if (status.pagamentoStatus === "PAGO") {
          setFinalizado("confirmado");
          onConfirmado?.();
          return;
        }
        if (status.status === "EXPIRADO" || status.status === "CANCELADO") {
          setFinalizado("expirado");
          onExpirado?.();
        }
      } catch {
        // polling continua na próxima rodada
      }
    }, 5000);
    return () => clearInterval(id);
  }, [agendamentoId, finalizado, onConfirmado, onExpirado]);

  const contagem = usarContagem(pix?.pixExpiracao ?? null);
  const expiradoPix = contagem === "Expirado";

  const copiar = useMemo(
    () => async () => {
      if (!pix?.pixCopiaCola) return;
      await navigator.clipboard
        .writeText(pix.pixCopiaCola)
        .catch(() => {
          const area = document.createElement("textarea");
          area.value = pix.pixCopiaCola;
          document.body.appendChild(area);
          area.select();
          document.execCommand("copy");
          document.body.removeChild(area);
        });
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    },
    [pix],
  );

  if (finalizado === "confirmado") {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-300">
        ✓ Sinal confirmado! Seu horário está garantido.
      </div>
    );
  }

  if (finalizado === "expirado") {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
        O prazo de pagamento expirou e o horário foi liberado. Faça um novo
        agendamento para garantir outro horário.
      </div>
    );
  }

  if (carregando && !pix) {
    return (
      <div className="py-4 text-center text-sm text-zinc-400">
        Gerando Pix do sinal...
      </div>
    );
  }

  if (erro && !pix) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {erro}
        <button
          onClick={buscarPix}
          className="mt-2 w-full rounded-lg border border-red-500 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!pix) return null;

  return (
    <div className="flex flex-col items-center">
      <p className="mb-1 text-sm text-zinc-400">
        Pague o sinal de{" "}
        <span className="font-semibold text-rose-400">
          {formatarBRL(pix.sinalValor)}
        </span>{" "}
        para garantir o seu horário
      </p>
      <p className="mb-3 text-xs text-zinc-500">
        Vencimento em <span className="font-mono text-zinc-300">{contagem}</span>
      </p>

      {pix.pixQrBase64 ? (
        <img
          src={`data:image/png;base64,${pix.pixQrBase64}`}
          alt="QR Code Pix para pagamento do sinal"
          width={220}
          height={220}
          className="h-44 w-44 rounded-xl border border-zinc-700 bg-white p-2"
        />
      ) : (
        <p className="py-4 text-sm text-zinc-400">
          Pix não disponível no momento.
        </p>
      )}

      <div className="mt-4 w-full">
        <label className="mb-1 block text-xs text-zinc-400">
          Ou copie o código Pix
        </label>
        <div className="flex gap-2">
          <input
            readOnly
            value={pix.pixCopiaCola}
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-mono text-zinc-200 outline-none"
          />
          <button
            onClick={copiar}
            className="shrink-0 rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-rose-400"
          >
            {copiado ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </div>

      {expiradoPix && (
        <button
          onClick={buscarPix}
          disabled={carregando}
          className="mt-4 w-full rounded-xl border border-rose-500 px-4 py-3 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {carregando ? "Gerando..." : "Gerar novo Pix"}
        </button>
      )}

      <p className="mt-4 text-center text-xs text-zinc-500">
        Confirmação automática em até 1 minuto após o pagamento.{sinalValor
          ? ` Faltam ${formatarBRL(sinalValor)} para o valor total.`
          : ""}
      </p>
    </div>
  );
}