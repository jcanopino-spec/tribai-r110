"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export type DcState = { error: string | null; ok: boolean };

export async function saveDcAction(
  declId: string,
  empresaId: string,
  _prev: DcState,
  form: FormData,
): Promise<DcState> {
  const supabase = await createClient();
  const update = {
    dc_cartera_0_90: parseNum(String(form.get("dc_cartera_0_90") ?? "")),
    dc_cartera_91_180: parseNum(String(form.get("dc_cartera_91_180") ?? "")),
    dc_cartera_181_360: parseNum(String(form.get("dc_cartera_181_360") ?? "")),
    dc_cartera_360_mas: parseNum(String(form.get("dc_cartera_360_mas") ?? "")),
    dc_metodo: String(form.get("dc_metodo") ?? "general"),
    dc_saldo_contable: parseNum(String(form.get("dc_saldo_contable") ?? "")),
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
