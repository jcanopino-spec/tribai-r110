"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNumeric(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addRecuperacionAction(
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

  const concepto = String(form.get("concepto") ?? "").trim();
  const descripcion = String(form.get("descripcion") ?? "").trim();
  const valor = parseNumeric(String(form.get("valor") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!concepto || !descripcion) {
    return { error: "Concepto y descripción son obligatorios.", ok: false };
  }
  if (valor <= 0) return { error: "El valor debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("anexo_recuperaciones").insert({
    declaracion_id: declId,
    concepto,
    descripcion,
    valor,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/recuperaciones`);
  return { error: null, ok: true };
}

export async function deleteRecuperacionAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_recuperaciones").delete().eq("id", id);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/recuperaciones`);
}
