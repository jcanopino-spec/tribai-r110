"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateDeclaracion } from "@/lib/revalidate";
import { F2516_H4_CATEGORIAS } from "@/engine/f2516-h4";

export type SaveH4State = { ok: boolean; error: string | null };

const numFromForm = (v: FormDataEntryValue | null): number => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export async function saveH4Action(
  declId: string,
  empresaId: string,
  _prev: SaveH4State,
  formData: FormData,
): Promise<SaveH4State> {
  const supabase = await createClient();

  const rows = F2516_H4_CATEGORIAS.map((cat) => ({
    declaracion_id: declId,
    categoria_id: cat.id,
    tipo: cat.tipo,
    concepto: cat.concepto,
    base_contable: numFromForm(formData.get(`bc_${cat.id}`)),
    base_fiscal: numFromForm(formData.get(`bf_${cat.id}`)),
    tarifa: numFromForm(formData.get(`tar_${cat.id}`)) || 0.35,
    observacion: (formData.get(`obs_${cat.id}`) as string) || null,
  }));

  const { error } = await supabase
    .from("formato_2516_h4_imp_diferido")
    .upsert(rows, { onConflict: "declaracion_id,categoria_id" });
  if (error) return { ok: false, error: error.message };

  revalidateDeclaracion(empresaId, declId);
  return { ok: true, error: null };
}
