"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { State, Tipo, Signo } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function saveUtilidadContableAction(
  declId: string,
  empresaId: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  const supabase = await createClient();
  const cf_utilidad_contable = parseNum(String(form.get("cf_utilidad_contable") ?? ""));

  const { error } = await supabase
    .from("declaraciones")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ cf_utilidad_contable, updated_at: new Date().toISOString() } as any)
    .eq("id", declId);
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/conciliacion-fiscal`);
  return { error: null, ok: true };
}

export async function addPartidaAction(
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

  const tipo = String(form.get("tipo") ?? "permanente") as Tipo;
  const signo = String(form.get("signo") ?? "mas") as Signo;
  const concepto = String(form.get("concepto") ?? "").trim();
  const valor = parseNum(String(form.get("valor") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!concepto) return { error: "Concepto es obligatorio.", ok: false };
  if (valor <= 0) return { error: "El valor debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("conciliacion_partidas").insert({
    declaracion_id: declId,
    tipo,
    signo,
    concepto,
    valor,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/conciliacion-fiscal`);
  return { error: null, ok: true };
}

export async function deletePartidaAction(id: number, declId: string, empresaId: string) {
  const supabase = await createClient();
  await supabase.from("conciliacion_partidas").delete().eq("id", id);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/conciliacion-fiscal`);
}
