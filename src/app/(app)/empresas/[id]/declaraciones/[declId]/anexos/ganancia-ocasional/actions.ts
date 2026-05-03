"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { Categoria, GoState } from "./consts";

function parseNumeric(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addGoAction(
  declId: string,
  empresaId: string,
  _prev: GoState,
  form: FormData,
): Promise<GoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada.", ok: false };

  const categoria = String(form.get("categoria") ?? "activo_fijo") as Categoria;
  const concepto = String(form.get("concepto") ?? "").trim();
  const precio_venta = parseNumeric(String(form.get("precio_venta") ?? ""));
  const costo_fiscal = parseNumeric(String(form.get("costo_fiscal") ?? ""));
  const no_gravada = parseNumeric(String(form.get("no_gravada") ?? ""));
  const recuperacion_depreciacion = parseNumeric(
    String(form.get("recuperacion_depreciacion") ?? ""),
  );

  if (!concepto) return { error: "Escribe el concepto u operación.", ok: false };
  if (precio_venta <= 0) {
    return { error: "El precio de venta / valor recibido debe ser mayor a cero.", ok: false };
  }

  const { error } = await supabase.from("anexo_ganancia_ocasional").insert({
    declaracion_id: declId,
    categoria,
    concepto,
    precio_venta,
    costo_fiscal,
    no_gravada,
    recuperacion_depreciacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteGoAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_ganancia_ocasional").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}
