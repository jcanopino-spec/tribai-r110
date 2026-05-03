"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export type SubState = { error: string | null; ok: boolean };

export async function saveSubAction(
  declId: string,
  empresaId: string,
  _prev: SubState,
  form: FormData,
): Promise<SubState> {
  const supabase = await createClient();
  const update = {
    sub_deuda_promedio: parseNum(String(form.get("sub_deuda_promedio") ?? "")),
    sub_intereses: parseNum(String(form.get("sub_intereses") ?? "")),
    sub_es_vinculado: form.get("sub_es_vinculado") === "on",
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("declaraciones")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(update as any)
    .eq("id", declId);
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}
