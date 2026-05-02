"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addIvaCapitalAction(
  declId: string,
  empresaId: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada.", ok: false };

  const factura = String(form.get("factura") ?? "").trim() || null;
  const fechaRaw = String(form.get("fecha") ?? "").trim();
  const fecha = fechaRaw || null;
  const bien = String(form.get("bien") ?? "").trim();
  const proveedor = String(form.get("proveedor") ?? "").trim() || null;
  const base = parseNum(String(form.get("base") ?? ""));
  const iva_pagado = parseNum(String(form.get("iva_pagado") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!bien) return { error: "Descripción del bien es obligatoria.", ok: false };
  if (iva_pagado <= 0) return { error: "El IVA pagado debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("anexo_iva_capital").insert({
    declaracion_id: declId,
    factura,
    fecha,
    bien,
    proveedor,
    base,
    iva_pagado,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/iva-capital`);
  return { error: null, ok: true };
}

export async function deleteIvaCapitalAction(id: number, declId: string, empresaId: string) {
  const supabase = await createClient();
  await supabase.from("anexo_iva_capital").delete().eq("id", id);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/iva-capital`);
}
