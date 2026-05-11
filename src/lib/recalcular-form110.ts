// Recálculo en cascada de form110_valores para una declaración.
//
// Re-ejecuta la lógica del script `fix_puc_mapping.py` pero desde TypeScript
// para que el usuario pueda forzar la actualización desde la UI sin esperar
// al script Python. Incluye:
//
//   1. Filtro anti-duplicación · solo cuentas hoja del balance
//   2. Saldo fiscal completo · `saldo + ajuste_debito - ajuste_credito`
//   3. Normalización de signo · pasivos/ingresos en positivo
//   4. Idempotente · DELETE + INSERT por declaracion_id

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

export async function recalcularForm110Valores(
  supabase: SupabaseClient<Database>,
  declId: string,
): Promise<{ ok: boolean; renglones: number; error?: string }> {
  // 1. Cargar balance · selecciona renglón_110 ya mapeado por PUC
  const { data: lineas, error: errLineas } = await supabase
    .from("balance_prueba_lineas")
    .select(
      "cuenta, saldo, ajuste_debito, ajuste_credito, renglon_110, balance_id, balance_pruebas!inner(declaracion_id)",
    )
    .eq("balance_pruebas.declaracion_id", declId);
  if (errLineas) return { ok: false, renglones: 0, error: errLineas.message };
  if (!lineas || lineas.length === 0) {
    return { ok: false, renglones: 0, error: "Sin balance cargado" };
  }

  // 2. Filtro anti-duplicación · solo cuentas hoja
  const todasCuentas = new Set(
    lineas.map((l) => String(l.cuenta).replace(/[^0-9]/g, "")),
  );
  const esHoja = (cuenta: string): boolean => {
    for (const otra of todasCuentas) {
      if (otra.length > cuenta.length && otra.startsWith(cuenta)) return false;
    }
    return true;
  };

  // 3. Agregar por renglón con saldo fiscal completo
  const agregado = new Map<number, number>();
  for (const l of lineas) {
    if (l.renglon_110 == null) continue;
    const cuentaNum = String(l.cuenta).replace(/[^0-9]/g, "");
    if (!cuentaNum) continue;
    if (!esHoja(cuentaNum)) continue;

    const saldoFiscal =
      Number(l.saldo) +
      Number(l.ajuste_debito ?? 0) -
      Number(l.ajuste_credito ?? 0);

    const prev = agregado.get(l.renglon_110) ?? 0;
    agregado.set(l.renglon_110, prev + saldoFiscal);
  }

  // 4. Normalización de signo
  // Pasivos (R45) e ingresos (R47-R57, R59, R60) tienen naturaleza crédito:
  // su suma natural es negativa, los convertimos a positivo.
  const normalizar = (rgl: number, valor: number): number => {
    if (rgl === 45) return Math.abs(valor);
    if (rgl >= 47 && rgl <= 57) return Math.abs(valor);
    if (rgl === 59 || rgl === 60) return Math.abs(valor);
    return valor;
  };

  // 5. DELETE + INSERT
  const { error: errDel } = await supabase
    .from("form110_valores")
    .delete()
    .eq("declaracion_id", declId);
  if (errDel) return { ok: false, renglones: 0, error: errDel.message };

  const rows = Array.from(agregado.entries())
    .map(([numero, valorRaw]) => {
      const valor = normalizar(numero, valorRaw);
      return { declaracion_id: declId, numero, valor };
    })
    .filter((r) => r.valor !== 0);

  if (rows.length > 0) {
    const { error: errIns } = await supabase
      .from("form110_valores")
      .insert(rows);
    if (errIns) return { ok: false, renglones: 0, error: errIns.message };
  }

  return { ok: true, renglones: rows.length };
}
