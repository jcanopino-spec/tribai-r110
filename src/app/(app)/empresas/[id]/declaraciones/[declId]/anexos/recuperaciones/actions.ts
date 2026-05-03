"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
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

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteRecuperacionAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_recuperaciones").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}

export async function updateRecuperacionAction(
  id: number,
  declId: string,
  empresaId: string,
  data: {
    concepto: string;
    descripcion: string;
    valor: number;
    observacion: string | null;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anexo_recuperaciones")
    .update({
      concepto: data.concepto.trim(),
      descripcion: data.descripcion.trim(),
      valor: data.valor,
      observacion: data.observacion?.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDeclaracion(empresaId, declId);
}
