"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

function parseNumeric(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export type RpState = { error: string | null; ok: boolean };

const FIELDS = [
  "rp_acciones_sociedades_nacionales",
  "rp_bienes_actividades_improductivas",
  "rp_bienes_fuerza_mayor",
  "rp_bienes_periodo_improductivo",
  "rp_bienes_mineria",
  "rp_primeros_19000_uvt_vivienda",
  "rp_renta_gravada_bienes_excluidos",
] as const;

export async function saveRentaPresuntivaAction(
  declId: string,
  empresaId: string,
  _prev: RpState,
  form: FormData,
): Promise<RpState> {
  const supabase = await createClient();
  const update: Record<string, number> = {};
  for (const f of FIELDS) {
    update[f] = parseNumeric(String(form.get(f) ?? ""));
  }

  const { error } = await supabase
    .from("declaraciones")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ ...update, updated_at: new Date().toISOString() } as any)
    .eq("id", declId);
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}
