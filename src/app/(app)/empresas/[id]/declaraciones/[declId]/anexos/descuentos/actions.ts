"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Categoria, DescuentoState } from "./consts";

function parseNumeric(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addDescuentoAction(
  declId: string,
  empresaId: string,
  _prev: DescuentoState,
  form: FormData,
): Promise<DescuentoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada.", ok: false };

  const categoria = String(form.get("categoria") ?? "otros") as Categoria;
  const descripcion = String(form.get("descripcion") ?? "").trim();
  const normatividad = String(form.get("normatividad") ?? "").trim() || null;
  const base = parseNumeric(String(form.get("base") ?? ""));
  const valor_descuento = parseNumeric(String(form.get("valor_descuento") ?? ""));

  if (!descripcion) return { error: "Escribe una descripción.", ok: false };
  if (valor_descuento <= 0) {
    return { error: "El valor del descuento debe ser mayor a cero.", ok: false };
  }

  const { error } = await supabase.from("anexo_descuentos").insert({
    declaracion_id: declId,
    categoria,
    descripcion,
    normatividad,
    base,
    valor_descuento,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/descuentos`);
  return { error: null, ok: true };
}

export async function deleteDescuentoAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_descuentos").delete().eq("id", id);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/descuentos`);
}
