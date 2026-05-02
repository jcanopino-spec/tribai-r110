"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addIcaAction(
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

  const municipio = String(form.get("municipio") ?? "").trim();
  const base_gravable = parseNum(String(form.get("base_gravable") ?? ""));
  const tarifa_milaje = parseNum(String(form.get("tarifa_milaje") ?? ""));
  const valor_pagado = parseNum(String(form.get("valor_pagado") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!municipio) return { error: "Municipio es obligatorio.", ok: false };
  if (valor_pagado < 0) return { error: "El valor pagado no puede ser negativo.", ok: false };

  const { error } = await supabase.from("anexo_ica").insert({
    declaracion_id: declId,
    municipio,
    base_gravable,
    tarifa_milaje,
    valor_pagado,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/ica`);
  return { error: null, ok: true };
}

export async function deleteIcaAction(id: number, declId: string, empresaId: string) {
  const supabase = await createClient();
  await supabase.from("anexo_ica").delete().eq("id", id);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/ica`);
}
