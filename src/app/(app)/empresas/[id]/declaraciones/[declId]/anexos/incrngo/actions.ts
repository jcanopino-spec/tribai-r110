"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addIncrngoAction(
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
  const normatividad = String(form.get("normatividad") ?? "").trim() || null;
  const valor = parseNum(String(form.get("valor") ?? ""));

  if (!concepto) return { error: "Escribe el concepto.", ok: false };
  if (valor <= 0) return { error: "El valor debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("anexo_incrngo").insert({
    declaracion_id: declId,
    concepto,
    normatividad,
    valor,
  });
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteIncrngoAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_incrngo").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}

export async function updateIncrngoAction(
  id: number,
  declId: string,
  empresaId: string,
  data: { concepto: string; normatividad: string | null; valor: number },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anexo_incrngo")
    .update({
      concepto: data.concepto.trim(),
      normatividad: data.normatividad?.trim() || null,
      valor: data.valor,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDeclaracion(empresaId, declId);
}
