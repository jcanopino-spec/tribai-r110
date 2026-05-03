"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addDividendoAction(
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

  const nit = String(form.get("nit") ?? "").trim() || null;
  const tercero = String(form.get("tercero") ?? "").trim();
  if (!tercero) return { error: "Nombre del tercero es obligatorio.", ok: false };

  const payload = {
    declaracion_id: declId,
    nit,
    tercero,
    no_constitutivos: parseNum(String(form.get("no_constitutivos") ?? "")),
    distribuidos_no_residentes: parseNum(String(form.get("distribuidos_no_residentes") ?? "")),
    gravados_tarifa_general: parseNum(String(form.get("gravados_tarifa_general") ?? "")),
    gravados_persona_natural_dos: parseNum(String(form.get("gravados_persona_natural_dos") ?? "")),
    gravados_personas_extranjeras: parseNum(String(form.get("gravados_personas_extranjeras") ?? "")),
    gravados_art_245: parseNum(String(form.get("gravados_art_245") ?? "")),
    gravados_tarifa_l1819: parseNum(String(form.get("gravados_tarifa_l1819") ?? "")),
    gravados_proyectos: parseNum(String(form.get("gravados_proyectos") ?? "")),
  };

  const total =
    payload.no_constitutivos +
    payload.distribuidos_no_residentes +
    payload.gravados_tarifa_general +
    payload.gravados_persona_natural_dos +
    payload.gravados_personas_extranjeras +
    payload.gravados_art_245 +
    payload.gravados_tarifa_l1819 +
    payload.gravados_proyectos;

  if (total <= 0) {
    return { error: "Ingresa al menos un valor en alguna categoría de dividendos.", ok: false };
  }

  const { error } = await supabase.from("anexo_dividendos").insert(payload);
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteDividendoAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_dividendos").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}

export async function updateDividendoAction(
  id: number,
  declId: string,
  empresaId: string,
  data: {
    nit: string | null;
    tercero: string;
    no_constitutivos: number;
    distribuidos_no_residentes: number;
    gravados_tarifa_general: number;
    gravados_persona_natural_dos: number;
    gravados_personas_extranjeras: number;
    gravados_art_245: number;
    gravados_tarifa_l1819: number;
    gravados_proyectos: number;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anexo_dividendos")
    .update({
      nit: data.nit?.trim() || null,
      tercero: data.tercero.trim(),
      no_constitutivos: data.no_constitutivos,
      distribuidos_no_residentes: data.distribuidos_no_residentes,
      gravados_tarifa_general: data.gravados_tarifa_general,
      gravados_persona_natural_dos: data.gravados_persona_natural_dos,
      gravados_personas_extranjeras: data.gravados_personas_extranjeras,
      gravados_art_245: data.gravados_art_245,
      gravados_tarifa_l1819: data.gravados_tarifa_l1819,
      gravados_proyectos: data.gravados_proyectos,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDeclaracion(empresaId, declId);
}
