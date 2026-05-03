"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addDivDistAction(
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

  const socio = String(form.get("socio") ?? "").trim();
  const nit = String(form.get("nit") ?? "").trim() || null;
  const participacion_pct = parseNum(String(form.get("participacion_pct") ?? ""));
  const dividendo_no_gravado = parseNum(String(form.get("dividendo_no_gravado") ?? ""));
  const dividendo_gravado = parseNum(String(form.get("dividendo_gravado") ?? ""));
  const retencion_aplicable = parseNum(String(form.get("retencion_aplicable") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!socio) return { error: "Nombre del socio es obligatorio.", ok: false };
  if (participacion_pct < 0 || participacion_pct > 100)
    return { error: "Participación debe estar entre 0 y 100%.", ok: false };

  const { error } = await supabase.from("anexo_dividendos_distribuir").insert({
    declaracion_id: declId,
    socio,
    nit,
    participacion_pct,
    dividendo_no_gravado,
    dividendo_gravado,
    retencion_aplicable,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteDivDistAction(id: number, declId: string, empresaId: string) {
  const supabase = await createClient();
  await supabase.from("anexo_dividendos_distribuir").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}

export async function updateDivDistAction(
  id: number,
  declId: string,
  empresaId: string,
  data: {
    socio: string;
    nit: string | null;
    participacion_pct: number;
    dividendo_no_gravado: number;
    dividendo_gravado: number;
    retencion_aplicable: number;
    observacion: string | null;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anexo_dividendos_distribuir")
    .update({
      socio: data.socio.trim(),
      nit: data.nit?.trim() || null,
      participacion_pct: data.participacion_pct,
      dividendo_no_gravado: data.dividendo_no_gravado,
      dividendo_gravado: data.dividendo_gravado,
      retencion_aplicable: data.retencion_aplicable,
      observacion: data.observacion?.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDeclaracion(empresaId, declId);
}
