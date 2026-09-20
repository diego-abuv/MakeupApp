"use client";

interface Props {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  confirmarLabel?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export default function ConfirmModal({
  aberto,
  titulo,
  mensagem,
  confirmarLabel = "Confirmar",
  onConfirmar,
  onCancelar,
}: Props) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm">
      <section className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-center">
        <h2 className="text-lg font-bold">{titulo}</h2>
        <p className="mt-2 text-sm text-zinc-400">{mensagem}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onConfirmar}
            className="w-full rounded-xl bg-rose-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-rose-400"
          >
            {confirmarLabel}
          </button>
          <button
            onClick={onCancelar}
            className="w-full rounded-xl border border-zinc-700 px-6 py-3 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}