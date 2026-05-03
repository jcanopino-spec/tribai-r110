"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshDeclaracionAction } from "./refresh-action";

export function RefreshButton({
  empresaId,
  declId,
}: {
  empresaId: string;
  declId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await refreshDeclaracionAction(empresaId, declId);
          router.refresh();
        })
      }
      title="Recalcula y refresca todas las páginas de la declaración"
      className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-xs font-medium text-background shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? (
        <>
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-background border-t-transparent" />
          Actualizando…
        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          Actualizar cálculos
        </>
      )}
    </button>
  );
}
