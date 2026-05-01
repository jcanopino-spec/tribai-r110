"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEstadoDeclaracionAction } from "../actions";

export function FinalizarButton({
  declId,
  empresaId,
  estado,
  bloqueado,
}: {
  declId: string;
  empresaId: string;
  estado: string;
  bloqueado: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const finalizada = estado === "finalizada";

  function toggle() {
    start(async () => {
      await setEstadoDeclaracionAction(declId, empresaId, finalizada ? "borrador" : "finalizada");
      router.refresh();
    });
  }

  if (finalizada) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-full border border-border-secondary px-5 text-sm hover:bg-muted disabled:opacity-50"
      >
        {pending ? "Reabriendo…" : "Reabrir como borrador"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending || bloqueado}
      className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Finalizando…" : "Finalizar declaración"}
    </button>
  );
}
