"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { State, Tipo } from "./consts";

function parseNumeric(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addCompensacionAction(
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

  const tipo = String(form.get("tipo") ?? "perdida") as Tipo;
  const ano_origen = Number(String(form.get("ano_origen") ?? "0"));
  const perdida_original = parseNumeric(String(form.get("perdida_original") ?? ""));
  const compensar = parseNumeric(String(form.get("compensar") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!Number.isInteger(ano_origen) || ano_origen < 2000 || ano_origen > 2100) {
    return { error: "Año de origen inválido.", ok: false };
  }
  if (compensar <= 0) return { error: "El valor a compensar debe ser mayor a cero.", ok: false };
  if (perdida_original > 0 && compensar > perdida_original) {
    return { error: "El valor a compensar no puede superar la pérdida original.", ok: false };
  }

  const { error } = await supabase.from("anexo_compensaciones").insert({
    declaracion_id: declId,
    tipo,
    ano_origen,
    perdida_original,
    compensar,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/compensaciones`);
  return { error: null, ok: true };
}

export async function deleteCompensacionAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_compensaciones").delete().eq("id", id);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/compensaciones`);
}
