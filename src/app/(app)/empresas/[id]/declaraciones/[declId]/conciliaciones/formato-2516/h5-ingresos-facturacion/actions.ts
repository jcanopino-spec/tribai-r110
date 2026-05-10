"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateDeclaracion } from "@/lib/revalidate";
import { F2516_H5_CONCEPTOS } from "@/engine/f2516-h5";

export type SaveH5State = { ok: boolean; error: string | null };

const num = (v: FormDataEntryValue | null): number => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export async function saveH5Action(
  declId: string,
  empresaId: string,
  _prev: SaveH5State,
  formData: FormData,
): Promise<SaveH5State> {
  const supabase = await createClient();

  const ingresos = F2516_H5_CONCEPTOS.map((cn) => ({
    declaracion_id: declId,
    concepto_id: cn.id,
    concepto: cn.concepto,
    gravados: num(formData.get(`gr_${cn.id}`)),
    exentos: num(formData.get(`ex_${cn.id}`)),
    excluidos: num(formData.get(`exc_${cn.id}`)),
    exportacion: num(formData.get(`exp_${cn.id}`)),
    observacion: (formData.get(`obs_${cn.id}`) as string) || null,
  }));

  const conciliacion = {
    declaracion_id: declId,
    total_facturado_dian: num(formData.get("total_facturado_dian")),
    notas_credito_emitidas: num(formData.get("notas_credito_emitidas")),
    notas_debito_emitidas: num(formData.get("notas_debito_emitidas")),
    observacion: (formData.get("conc_observacion") as string) || null,
  };

  const { error: e1 } = await supabase
    .from("formato_2516_h5_ingresos")
    .upsert(ingresos, { onConflict: "declaracion_id,concepto_id" });
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await supabase
    .from("formato_2516_h5_conciliacion")
    .upsert(conciliacion, { onConflict: "declaracion_id" });
  if (e2) return { ok: false, error: e2.message };

  revalidateDeclaracion(empresaId, declId);
  return { ok: true, error: null };
}
