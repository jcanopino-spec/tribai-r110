"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { State, Tipo } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addDifCambioAction(
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

  const tipo = String(form.get("tipo") ?? "activo") as Tipo;
  const cuenta = String(form.get("cuenta") ?? "").trim() || null;
  const nit = String(form.get("nit") ?? "").trim() || null;
  const tercero = String(form.get("tercero") ?? "").trim();
  const fechaRaw = String(form.get("fecha_transaccion") ?? "").trim();
  const fecha_transaccion = fechaRaw || null;
  const valor_usd = parseNum(String(form.get("valor_usd") ?? ""));
  const trm_inicial = parseNum(String(form.get("trm_inicial") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!tercero) return { error: "Nombre del tercero es obligatorio.", ok: false };
  if (valor_usd <= 0) return { error: "El valor en USD debe ser mayor a cero.", ok: false };
  if (trm_inicial <= 0) return { error: "La TRM inicial debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("anexo_diferencia_cambio").insert({
    declaracion_id: declId,
    tipo,
    cuenta,
    nit,
    tercero,
    fecha_transaccion,
    valor_usd,
    trm_inicial,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteDifCambioAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_diferencia_cambio").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}
