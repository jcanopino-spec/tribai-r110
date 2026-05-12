"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateDeclaracion } from "@/lib/revalidate";

export type SaveH3State = { ok: boolean; error: string | null };

export async function saveH3BulkAction(
  declId: string,
  empresaId: string,
  _prev: SaveH3State,
  formData: FormData,
): Promise<SaveH3State> {
  const supabase = await createClient();

  // Acumular ajustes por renglón
  // Campos esperados: ajuste_{rid}_{campo} donde campo ∈ {conversion, menor, mayor,
  //   rl_gen, rl_zf, rl_ece, rl_mega, rl_par5, rl_div, rl_go}
  type Ajuste = {
    conversion: number;
    menor: number;
    mayor: number;
    rl_gen: number;
    rl_zf: number;
    rl_ece: number;
    rl_mega: number;
    rl_par5: number;
    rl_div: number;
    rl_go: number;
  };
  const ajustes = new Map<number, Ajuste>();
  const empty: Ajuste = {
    conversion: 0, menor: 0, mayor: 0,
    rl_gen: 0, rl_zf: 0, rl_ece: 0, rl_mega: 0,
    rl_par5: 0, rl_div: 0, rl_go: 0,
  };

  for (const [key, val] of formData.entries()) {
    const m = key.match(/^ajuste_(\d+)_(\w+)$/);
    if (!m) continue;
    const rid = Number(m[1]);
    const campo = m[2] as keyof Ajuste;
    if (!(campo in empty)) continue;
    const n = Number(String(val).replace(/[^\d.\-]/g, ""));
    if (!Number.isFinite(n)) continue;
    const cur = ajustes.get(rid) ?? { ...empty };
    cur[campo] = n;
    ajustes.set(rid, cur);
  }

  const rows = Array.from(ajustes.entries())
    .filter(([, v]) => Object.values(v).some((x) => x !== 0))
    .map(([renglonId, v]) => ({
      declaracion_id: declId,
      renglon_id: renglonId,
      conversion: v.conversion,
      menor_fiscal: v.menor,
      mayor_fiscal: v.mayor,
      rl_tarifa_general: v.rl_gen,
      rl_zf: v.rl_zf,
      rl_ece: v.rl_ece,
      rl_mega_inv: v.rl_mega,
      rl_par5: v.rl_par5,
      rl_dividendos: v.rl_div,
      rl_go: v.rl_go,
    }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("formato_2516_h3_ajustes")
      .upsert(rows, { onConflict: "declaracion_id,renglon_id" });
    if (error) return { ok: false, error: error.message };
  }

  revalidateDeclaracion(empresaId, declId);
  return { ok: true, error: null };
}
