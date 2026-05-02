"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RetencionState = { error: string | null; ok: boolean };

export const CONCEPTOS_RETENCION = [
  "Por ventas",
  "Por servicios",
  "Por honorarios y comisiones",
  "Por rendimientos financieros",
  "Por dividendos y participaciones",
  "Retenciones Ganancias Ocasionales",
  "Otras retenciones",
] as const;

export const CONCEPTOS_AUTORRETENCION = [
  "Autorretención Decreto 2201 del 2016",
  "Por ventas",
  "Por servicios",
  "Por honorarios y comisiones",
  "Otras autorretenciones",
] as const;

function parseNumeric(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addRetencionAction(
  declId: string,
  empresaId: string,
  _prev: RetencionState,
  form: FormData,
): Promise<RetencionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada.", ok: false };

  const tipo = String(form.get("tipo") ?? "retencion") as "retencion" | "autorretencion";
  const concepto = String(form.get("concepto") ?? "").trim();
  const agente = String(form.get("agente") ?? "").trim() || null;
  const nit = String(form.get("nit") ?? "").trim() || null;
  const base = parseNumeric(String(form.get("base") ?? ""));
  const retenido = parseNumeric(String(form.get("retenido") ?? ""));

  if (!concepto) return { error: "Selecciona un concepto.", ok: false };
  if (retenido <= 0) return { error: "El valor retenido debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("anexo_retenciones").insert({
    declaracion_id: declId,
    tipo,
    concepto,
    agente,
    nit,
    base,
    retenido,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/retenciones`);
  return { error: null, ok: true };
}

export async function deleteRetencionAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_retenciones").delete().eq("id", id);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/retenciones`);
}
