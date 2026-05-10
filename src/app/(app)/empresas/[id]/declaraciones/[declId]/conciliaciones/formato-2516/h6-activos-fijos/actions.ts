"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateDeclaracion } from "@/lib/revalidate";
import { F2516_H6_CATEGORIAS } from "@/engine/f2516-h6";

export type SaveH6State = { ok: boolean; error: string | null };

const num = (v: FormDataEntryValue | null): number => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export async function saveH6Action(
  declId: string,
  empresaId: string,
  _prev: SaveH6State,
  formData: FormData,
): Promise<SaveH6State> {
  const supabase = await createClient();

  const rows = F2516_H6_CATEGORIAS.map((cat) => ({
    declaracion_id: declId,
    categoria_id: cat.id,
    categoria: cat.categoria,
    saldo_inicial: num(formData.get(`si_${cat.id}`)),
    adiciones: num(formData.get(`ad_${cat.id}`)),
    retiros: num(formData.get(`re_${cat.id}`)),
    deprec_acumulada: num(formData.get(`dac_${cat.id}`)),
    deprec_ano: num(formData.get(`dan_${cat.id}`)),
    ajuste_fiscal: num(formData.get(`af_${cat.id}`)),
    observacion: (formData.get(`obs_${cat.id}`) as string) || null,
  }));

  const { error } = await supabase
    .from("formato_2516_h6_activos_fijos")
    .upsert(rows, { onConflict: "declaracion_id,categoria_id" });
  if (error) return { ok: false, error: error.message };

  revalidateDeclaracion(empresaId, declId);
  return { ok: true, error: null };
}
