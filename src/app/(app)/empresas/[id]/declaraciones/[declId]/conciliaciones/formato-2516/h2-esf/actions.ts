"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateDeclaracion } from "@/lib/revalidate";

export type SaveH2State = { ok: boolean; error: string | null };

export async function saveH2AjusteAction(
  declId: string,
  empresaId: string,
  renglonId: number,
  _prev: SaveH2State,
  formData: FormData,
): Promise<SaveH2State> {
  const supabase = await createClient();
  const num = (k: string): number => {
    const v = formData.get(k);
    if (v == null || v === "") return 0;
    const n = Number(String(v).replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const get = (k: string) => {
    const v = formData.get(k);
    return v == null || v === "" ? null : String(v);
  };

  const { error } = await supabase
    .from("formato_2516_h2_ajustes")
    .upsert(
      {
        declaracion_id: declId,
        renglon_id: renglonId,
        conversion: num("conversion"),
        menor_fiscal: num("menor_fiscal"),
        mayor_fiscal: num("mayor_fiscal"),
        observacion: get("observacion"),
      },
      { onConflict: "declaracion_id,renglon_id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidateDeclaracion(empresaId, declId);
  return { ok: true, error: null };
}

export async function saveH2BulkAction(
  declId: string,
  empresaId: string,
  _prev: SaveH2State,
  formData: FormData,
): Promise<SaveH2State> {
  const supabase = await createClient();

  // Recopilar ajustes por renglón · formato del input: ajuste_{renglon_id}_{campo}
  const ajustes = new Map<number, { conversion: number; menor: number; mayor: number }>();

  for (const [key, val] of formData.entries()) {
    const m = key.match(/^ajuste_(\d+)_(conversion|menor|mayor)$/);
    if (!m) continue;
    const renglonId = Number(m[1]);
    const campo = m[2] as "conversion" | "menor" | "mayor";
    const n = Number(String(val).replace(/[^\d.\-]/g, ""));
    if (!Number.isFinite(n)) continue;
    const cur = ajustes.get(renglonId) ?? { conversion: 0, menor: 0, mayor: 0 };
    cur[campo] = n;
    ajustes.set(renglonId, cur);
  }

  const rows = Array.from(ajustes.entries())
    .filter(([, v]) => v.conversion !== 0 || v.menor !== 0 || v.mayor !== 0)
    .map(([renglonId, v]) => ({
      declaracion_id: declId,
      renglon_id: renglonId,
      conversion: v.conversion,
      menor_fiscal: v.menor,
      mayor_fiscal: v.mayor,
    }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("formato_2516_h2_ajustes")
      .upsert(rows, { onConflict: "declaracion_id,renglon_id" });
    if (error) return { ok: false, error: error.message };
  }

  revalidateDeclaracion(empresaId, declId);
  return { ok: true, error: null };
}
