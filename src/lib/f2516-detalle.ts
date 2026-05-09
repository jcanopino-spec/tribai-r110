// Loader del F2516 detallado · agrupa el balance del usuario contra el
// catálogo de cuentas del Detalle Fiscal del .xlsm. Cada cuenta del catálogo
// recibe el saldo CONTABLE (suma natural por prefijo PUC) y el saldo FISCAL
// (saldo + ajuste_debito - ajuste_credito).
//
// Replica la fórmula del .xlsm:
//   =SUMIF('Balance de Prueba'!$C$10:$C$2509, C<row> & "*", saldos)
//
// Usa el filtro anti-duplicación (excluye cuentas resumen del balance que
// tengan hijas presentes) introducido en f2516-aggregates.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  DETALLE_FISCAL_2516,
  type DetalleFiscalItem,
} from "@/engine/f2516-detalle";

export type FilaDetalleCalculada = {
  item: DetalleFiscalItem;
  /** Saldo contable agregado por prefijo PUC. */
  contable: number;
  /** Saldo fiscal = saldo + ajuste_debito - ajuste_credito. */
  fiscal: number;
  /** Diferencia fiscal − contable. */
  diferencia: number;
  /** Sólo para "renglon_total": valor F2516 final del renglón (suma hijas). */
  totalRenglon?: { contable: number; fiscal: number };
};

/**
 * Construye el F2516 detallado completo (262 filas).
 *
 * @param supabase cliente RLS-aware
 * @param declId   declaración
 * @returns lista ordenada · cada renglón total seguido de sus cuentas
 */
export async function loadF2516DetalleCompleto(
  supabase: SupabaseClient<Database>,
  declId: string,
): Promise<FilaDetalleCalculada[]> {
  // Último balance subido
  const { data: balance } = await supabase
    .from("balance_pruebas")
    .select("id")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!balance) {
    return DETALLE_FISCAL_2516.map((item) => ({
      item,
      contable: 0,
      fiscal: 0,
      diferencia: 0,
    }));
  }

  const { data: lineas } = await supabase
    .from("balance_prueba_lineas")
    .select("cuenta, saldo, ajuste_debito, ajuste_credito")
    .eq("balance_id", balance.id);

  // Filtro anti-duplicación: detectar cuentas resumen
  const todasCuentas = new Set<string>();
  for (const l of lineas ?? []) {
    const c = String(l.cuenta).replace(/[^0-9]/g, "");
    if (c) todasCuentas.add(c);
  }
  const tieneHijas = (cuenta: string): boolean => {
    for (const otra of todasCuentas) {
      if (otra.length > cuenta.length && otra.startsWith(cuenta)) return true;
    }
    return false;
  };

  // Líneas hoja (sin cuentas resumen)
  const lineasHoja = (lineas ?? []).filter((l) => {
    const c = String(l.cuenta).replace(/[^0-9]/g, "");
    return c.length > 0 && !tieneHijas(c);
  });

  /**
   * Agrega el saldo contable y fiscal de todas las líneas hoja cuya cuenta
   * comience con el prefijo dado. Replica el SUMIF del .xlsm.
   */
  function sumifPorPrefijo(prefijo: string): { contable: number; fiscal: number } {
    let contable = 0;
    let fiscal = 0;
    for (const l of lineasHoja) {
      const c = String(l.cuenta).replace(/[^0-9]/g, "");
      if (c.startsWith(prefijo)) {
        const saldo = Number(l.saldo);
        const aj =
          Number(l.ajuste_debito) - Number(l.ajuste_credito);
        contable += saldo;
        fiscal += saldo + aj;
      }
    }
    return { contable, fiscal };
  }

  // Calcular cada item del catálogo
  const filas: FilaDetalleCalculada[] = DETALLE_FISCAL_2516.map((item) => {
    if (item.tipo === "cuenta" && item.puc) {
      const { contable, fiscal } = sumifPorPrefijo(item.puc);
      return {
        item,
        contable,
        fiscal,
        diferencia: fiscal - contable,
      };
    }
    // renglon_total · se calculará agregando las cuentas hijas
    return {
      item,
      contable: 0,
      fiscal: 0,
      diferencia: 0,
    };
  });

  // Agregar las cuentas hijas a su renglón_total
  let renglonActualIdx = -1;
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    if (f.item.tipo === "renglon_total") {
      renglonActualIdx = i;
    } else if (f.item.tipo === "cuenta" && renglonActualIdx >= 0) {
      filas[renglonActualIdx].contable += f.contable;
      filas[renglonActualIdx].fiscal += f.fiscal;
    }
  }
  // Recalcular diferencia para los renglones-total
  for (const f of filas) {
    if (f.item.tipo === "renglon_total") {
      f.diferencia = f.fiscal - f.contable;
      f.totalRenglon = { contable: f.contable, fiscal: f.fiscal };
    }
  }

  return filas;
}

/**
 * Agrupa las filas calculadas por renglón total para presentación en árbol:
 *   { renglón → { total, cuentas[] } }
 */
export function agruparPorRenglon(
  filas: ReadonlyArray<FilaDetalleCalculada>,
): Map<number, { total: FilaDetalleCalculada; cuentas: FilaDetalleCalculada[] }> {
  const map = new Map<
    number,
    { total: FilaDetalleCalculada; cuentas: FilaDetalleCalculada[] }
  >();
  let actual: number | null = null;
  for (const f of filas) {
    if (f.item.tipo === "renglon_total" && f.item.rgl !== null) {
      actual = f.item.rgl;
      map.set(actual, { total: f, cuentas: [] });
    } else if (f.item.tipo === "cuenta" && actual !== null) {
      map.get(actual)?.cuentas.push(f);
    }
  }
  return map;
}
