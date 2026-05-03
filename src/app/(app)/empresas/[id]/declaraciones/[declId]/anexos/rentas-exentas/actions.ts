"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNumeric(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addRentaExentaAction(
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

  const descripcion = String(form.get("descripcion") ?? "").trim();
  const normatividad = String(form.get("normatividad") ?? "").trim() || null;
  const valor_fiscal = parseNumeric(String(form.get("valor_fiscal") ?? ""));

  if (!descripcion) return { error: "Escribe la descripción.", ok: false };
  if (valor_fiscal <= 0) return { error: "El valor debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("anexo_rentas_exentas").insert({
    declaracion_id: declId,
    descripcion,
    normatividad,
    valor_fiscal,
  });
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteRentaExentaAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_rentas_exentas").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}

export async function updateRentaExentaAction(
  id: number,
  declId: string,
  empresaId: string,
  data: {
    descripcion: string;
    normatividad: string | null;
    valor_fiscal: number;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anexo_rentas_exentas")
    .update({
      descripcion: data.descripcion.trim(),
      normatividad: data.normatividad?.trim() || null,
      valor_fiscal: data.valor_fiscal,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDeclaracion(empresaId, declId);
}
