"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { State, TipoInversion } from "./consts";

function parseNumeric(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addInversionEsalAction(
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

  const tipo = String(form.get("tipo") ?? "") as TipoInversion;
  if (tipo !== "efectuada" && tipo !== "liquidada") {
    return { error: "Tipo inválido.", ok: false };
  }
  const concepto = String(form.get("concepto") ?? "").trim();
  const categoria = String(form.get("categoria") ?? "").trim() || null;
  const fechaRaw = String(form.get("fecha") ?? "").trim();
  const fecha = fechaRaw ? fechaRaw : null;
  const anoOrigenRaw = String(form.get("ano_origen") ?? "").trim();
  const ano_origen = anoOrigenRaw ? Number(anoOrigenRaw) : null;
  const valor = parseNumeric(String(form.get("valor") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!concepto) return { error: "Concepto es obligatorio.", ok: false };
  if (valor <= 0) return { error: "El valor debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("anexo_inversiones_esal").insert({
    declaracion_id: declId,
    tipo,
    fecha,
    ano_origen,
    concepto,
    categoria,
    valor,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteInversionEsalAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_inversiones_esal").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}

export async function updateInversionEsalAction(
  id: number,
  declId: string,
  empresaId: string,
  data: {
    tipo: TipoInversion;
    fecha: string | null;
    ano_origen: number | null;
    concepto: string;
    categoria: string | null;
    valor: number;
    observacion: string | null;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anexo_inversiones_esal")
    .update({
      tipo: data.tipo,
      fecha: data.fecha,
      ano_origen: data.ano_origen,
      concepto: data.concepto.trim(),
      categoria: data.categoria?.trim() || null,
      valor: data.valor,
      observacion: data.observacion?.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDeclaracion(empresaId, declId);
}
