"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addGmfAction(
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

  const entidad = String(form.get("entidad") ?? "").trim();
  const periodo = String(form.get("periodo") ?? "").trim() || null;
  const valor_gmf = parseNum(String(form.get("valor_gmf") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!entidad) return { error: "Entidad financiera es obligatoria.", ok: false };
  if (valor_gmf <= 0) return { error: "El valor de GMF debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("anexo_gmf").insert({
    declaracion_id: declId,
    entidad,
    periodo,
    valor_gmf,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/gmf`);
  return { error: null, ok: true };
}

export async function deleteGmfAction(id: number, declId: string, empresaId: string) {
  const supabase = await createClient();
  await supabase.from("anexo_gmf").delete().eq("id", id);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/anexos/gmf`);
}
