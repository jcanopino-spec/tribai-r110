// Loader del Papel de Trabajo Revisoría Fiscal · arquitectura modelo guía.
// Trae todo lo que la generación Excel necesita en una sola pasada.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { loadPapelTrabajoData } from "@/lib/papel-trabajo-data";
import { F2516_H2_CATALOGO } from "@/engine/f2516-h2-catalogo";
import { F2516_H3_CATALOGO } from "@/engine/f2516-h3-catalogo";
import { MAPEO_PUC_H2 } from "@/engine/f2516-mapeo-h2";
import { MAPEO_PUC_H3 } from "@/engine/f2516-mapeo-h3";

export type BalanceLinea = {
  cuenta: string;
  nombre: string;
  saldo: number;
  ajuste_debito: number;
  ajuste_credito: number;
  renglon_h2: number | null;
  renglon_h3: number | null;
  es_hoja: boolean;
};

export type PapelTrabajoRFData = Awaited<ReturnType<typeof loadPapelTrabajoRFData>>;

function resolverRenglon(
  cuenta: string,
  mapping: Record<string, number>,
): number | null {
  if (mapping[cuenta] != null) return mapping[cuenta];
  for (let n = cuenta.length - 1; n >= 2; n--) {
    const p = cuenta.substring(0, n);
    if (mapping[p] != null) return mapping[p];
  }
  return null;
}

export async function loadPapelTrabajoRFData(
  supabase: SupabaseClient<Database>,
  declId: string,
) {
  const base = await loadPapelTrabajoData(supabase, declId);

  // Balance de prueba completo
  const { data: bps } = await supabase
    .from("balance_pruebas")
    .select("id")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  let balance: BalanceLinea[] = [];
  if (bps?.length) {
    const { data: lineas } = await supabase
      .from("balance_prueba_lineas")
      .select("cuenta, nombre, saldo, ajuste_debito, ajuste_credito")
      .eq("balance_id", bps[0].id)
      .order("cuenta");

    // Mapeo manual override
    const { data: mapManual } = await supabase
      .from("balance_renglon_h2_h3")
      .select("cuenta, renglon_h2, renglon_h3")
      .eq("declaracion_id", declId);
    const overrideH2 = new Map<string, number>();
    const overrideH3 = new Map<string, number>();
    for (const m of mapManual ?? []) {
      if (m.renglon_h2 != null) overrideH2.set(String(m.cuenta), m.renglon_h2);
      if (m.renglon_h3 != null) overrideH3.set(String(m.cuenta), m.renglon_h3);
    }

    const todasCuentas = new Set((lineas ?? []).map((l) => String(l.cuenta)));
    const esHoja = (cta: string) => {
      for (const o of todasCuentas) {
        if (o !== cta && o.startsWith(cta)) return false;
      }
      return true;
    };

    balance = (lineas ?? []).map((l) => {
      const cuenta = String(l.cuenta);
      const c0 = cuenta[0];
      const enH2 = c0 === "1" || c0 === "2" || c0 === "3";
      const enH3 = c0 === "4" || c0 === "5" || c0 === "6" || c0 === "7";
      const renglon_h2 = enH2
        ? (overrideH2.get(cuenta) ?? resolverRenglon(cuenta, MAPEO_PUC_H2))
        : null;
      const renglon_h3 = enH3
        ? (overrideH3.get(cuenta) ?? resolverRenglon(cuenta, MAPEO_PUC_H3))
        : null;
      return {
        cuenta,
        nombre: l.nombre ?? "",
        saldo: Number(l.saldo ?? 0),
        ajuste_debito: Number(l.ajuste_debito ?? 0),
        ajuste_credito: Number(l.ajuste_credito ?? 0),
        renglon_h2,
        renglon_h3,
        es_hoja: esHoja(cuenta),
      };
    });
  }

  // Renglones catalogo F-110 ya viene en base.renglones

  return {
    ...base,
    balance,
    h2Catalogo: F2516_H2_CATALOGO,
    h3Catalogo: F2516_H3_CATALOGO,
  };
}
