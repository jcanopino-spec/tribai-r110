"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { RetencionState } from "./consts";

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

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteRetencionAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_retenciones").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}

export async function updateRetencionAction(
  id: number,
  declId: string,
  empresaId: string,
  data: {
    tipo: "retencion" | "autorretencion";
    concepto: string;
    agente: string | null;
    nit: string | null;
    base: number;
    retenido: number;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anexo_retenciones")
    .update({
      tipo: data.tipo,
      concepto: data.concepto.trim(),
      agente: data.agente?.trim() || null,
      nit: data.nit?.trim() || null,
      base: data.base,
      retenido: data.retenido,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDeclaracion(empresaId, declId);
}
