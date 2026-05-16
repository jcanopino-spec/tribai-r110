"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Dispara router.refresh() la primera vez que la acción de servidor retorna
// ok=true. Útil para forms que usan useActionState y necesitan repintar la
// página (lista + cualquier renglón derivado del anexo en el F-110, F-2516,
// dashboard, etc).
//
// El action server-side ya hace revalidatePath(..., "layout") vía
// revalidateDeclaracion, así que con router.refresh() Next.js re-fetcha el
// RSC payload del layout invalidado y todos los lectores ven valores frescos.
export function useRefreshOnSuccess(state: { ok?: boolean }) {
  const router = useRouter();
  const wasOk = useRef(false);
  useEffect(() => {
    if (state.ok && !wasOk.current) {
      router.refresh();
    }
    wasOk.current = !!state.ok;
  }, [state.ok, router]);
}
