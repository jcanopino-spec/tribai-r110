"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addInteresAction(
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
  const cuenta = String(form.get("cuenta") ?? "").trim() || null;
  const saldo_promedio = parseNum(String(form.get("saldo_promedio") ?? ""));
  const diasRaw = Number(String(form.get("dias") ?? "360"));
  const dias = Number.isInteger(diasRaw) && diasRaw > 0 ? Math.min(diasRaw, 365) : 360;
  const interes_registrado = parseNum(String(form.get("interes_registrado") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!socio) return { error: "Nombre del socio es obligatorio.", ok: false };
  if (saldo_promedio <= 0)
    return { error: "El saldo promedio debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("anexo_intereses_presuntivos").insert({
    declaracion_id: declId,
    socio,
    cuenta,
    saldo_promedio,
    dias,
    interes_registrado,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/intereses-presuntivos`);
  return { error: null, ok: true };
}

export async function deleteInteresAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_intereses_presuntivos").delete().eq("id", id);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/intereses-presuntivos`);
}
