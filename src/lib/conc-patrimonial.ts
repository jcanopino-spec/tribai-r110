// Cálculo Art. 236 E.T. · conciliación patrimonial.
//
// Diferencia entre el patrimonio líquido del año y el anterior debe estar
// justificada por las rentas declaradas. Lo que NO se justifica entra
// como renta presumida (R78 del F110).
//
//   diferencia      = max(0, PL_actual + desvalorizaciones − valorizaciones − PL_anterior)
//   rentas ajustadas = max(0, R75 + R77 + R60 + R83 + normalización − saldo_pagar_anterior − R107)
//   renta por comp.  = max(0, diferencia − rentas ajustadas)
//
// Si `aniosDeclarando === "primero"` la conciliación no aplica (sin AG anterior).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

type DeclMin = {
  patrimonio_bruto_anterior?: number | string | null;
  pasivos_anterior?: number | string | null;
  saldo_pagar_anterior?: number | string | null;
  anios_declarando?: string | null;
};

export type ConcPatrimonialResultado = {
  diferenciaPatrimonial: number;
  rentasAjustadas: number;
  rentaPorComparacion: number;
  esPrimeraVez: boolean;
  /** Detalle para mostrar al usuario · partidas que entraron al cálculo. */
  partidas: {
    valorizaciones: number;
    desvalorizaciones: number;
    normalizacionTributaria: number;
  };
};

/**
 * Calcula la renta por comparación patrimonial del Art. 236 desde la BD
 * para una declaración. No depende de UI · usable desde validaciones,
 * dashboard, exports, etc.
 */
export async function loadRentaComparacionPatrimonial(
  supabase: SupabaseClient<Database>,
  declId: string,
  declaracion: DeclMin,
  valoresF110: Map<number, number>,
): Promise<ConcPatrimonialResultado> {
  const v = (n: number) => valoresF110.get(n) ?? 0;
  const plActual = v(46);
  const plAnterior =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);

  // Cargar partidas manuales · clasificadas por keyword en concepto
  const { data: partidas } = await supabase
    .from("conciliacion_patrimonial_partidas")
    .select("signo, concepto, valor")
    .eq("declaracion_id", declId);

  let valorizaciones = 0;
  let desvalorizaciones = 0;
  let normalizacionTributaria = 0;
  for (const p of partidas ?? []) {
    const concepto = String(p.concepto || "").toLowerCase();
    const valor = Number(p.valor);
    if (/desvalorizaci/i.test(concepto)) desvalorizaciones += valor;
    else if (/valorizaci/i.test(concepto)) valorizaciones += valor;
    else if (/normalizaci/i.test(concepto)) normalizacionTributaria += valor;
    // Otras partidas se aplican según el signo
    else if (p.signo === "mas") normalizacionTributaria += valor;
    else if (p.signo === "menos") normalizacionTributaria -= valor;
  }

  const diferenciaPatrimonial = Math.max(
    0,
    plActual + desvalorizaciones - valorizaciones - plAnterior,
  );
  const rentasAjustadas = Math.max(
    0,
    v(75) +
      v(77) +
      v(60) +
      v(83) +
      normalizacionTributaria -
      Number(declaracion.saldo_pagar_anterior ?? 0) -
      v(107),
  );

  const esPrimeraVez = declaracion.anios_declarando === "primero";
  const rentaPorComparacion = esPrimeraVez
    ? 0
    : Math.max(0, diferenciaPatrimonial - rentasAjustadas);

  return {
    diferenciaPatrimonial,
    rentasAjustadas,
    rentaPorComparacion,
    esPrimeraVez,
    partidas: { valorizaciones, desvalorizaciones, normalizacionTributaria },
  };
}
