"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addPredialAction(
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

  const predio = String(form.get("predio") ?? "").trim();
  const direccion = String(form.get("direccion") ?? "").trim() || null;
  const matricula = String(form.get("matricula") ?? "").trim() || null;
  const avaluo = parseNum(String(form.get("avaluo") ?? ""));
  const valor_pagado = parseNum(String(form.get("valor_pagado") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!predio) return { error: "Identificación del predio es obligatoria.", ok: false };
  if (valor_pagado < 0) return { error: "El valor pagado no puede ser negativo.", ok: false };

  const { error } = await supabase.from("anexo_predial").insert({
    declaracion_id: declId,
    predio,
    direccion,
    matricula,
    avaluo,
    valor_pagado,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/predial`);
  return { error: null, ok: true };
}

export async function deletePredialAction(id: number, declId: string, empresaId: string) {
  const supabase = await createClient();
  await supabase.from("anexo_predial").delete().eq("id", id);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/predial`);
}
