// Cargador Supabase de la Conciliación Patrimonial · alimenta el engine.
//
// Lee del F110 computado los valores de R46, R72, R96, R60, R80/81, R97/98
// y de la declaración el patrimonio anterior y la deducción Art. 158-3.
// Para los gastos no deducidos suma las partidas de `conciliacion_partidas`
// con `categoria_nic12=permanente` y subcategoría `gastos_no_deducibles`
// que automáticamente provienen de Conc Utilidades.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  computarConcPatrimonial,
  clasificarBucket,
  type ConcPatrimonialInput,
  type ConcPatrimonialResultado,
  type PartidaManualPatrimonial,
} from "@/engine/conc-patrimonial";

type DeclMin = {
  patrimonio_bruto_anterior?: number | string | null;
  pasivos_anterior?: number | string | null;
  saldo_pagar_anterior?: number | string | null;
  anios_declarando?: string | null;
  deduccion_art_158_3?: number | string | null;
};

const num = (v: number | string | null | undefined): number =>
  v == null ? 0 : Number(v);

/**
 * Carga la conciliación patrimonial completa para una declaración.
 *
 * Replica el modelo del archivo Aries (actualicese.com):
 *   - PL anterior del año previo
 *   - Justificantes: renta líquida − imp neto, INCRNGO, Art. 158-3, GO neta
 *   - Restadores: gastos no deducidos, saldo pagar anterior
 *   - Partidas manuales del usuario (valorizaciones, normalización)
 *   - Renta por comparación si la diferencia es positiva
 */
export async function loadConcPatrimonial(
  supabase: SupabaseClient<Database>,
  declId: string,
  declaracion: DeclMin,
  valoresF110: Map<number, number>,
): Promise<ConcPatrimonialResultado> {
  const v = (n: number) => valoresF110.get(n) ?? 0;

  // Patrimonio líquido anterior
  const plAnterior =
    num(declaracion.patrimonio_bruto_anterior) - num(declaracion.pasivos_anterior);

  // Partidas manuales
  const { data: partidasManualesRaw } = await supabase
    .from("conciliacion_patrimonial_partidas")
    .select("id, signo, concepto, valor, observacion")
    .eq("declaracion_id", declId);
  const partidasManuales: PartidaManualPatrimonial[] = (
    partidasManualesRaw ?? []
  ).map((p) => ({
    id: p.id,
    signo: p.signo as "mas" | "menos",
    concepto: p.concepto,
    valor: Number(p.valor),
    observacion: p.observacion,
    bucket: clasificarBucket(p.concepto, p.signo as "mas" | "menos"),
  }));

  // Gastos NO deducidos en renta fiscal · vienen de Conc Utilidades.
  // Suma de partidas con tipo=permanente y signo=mas (gastos contables no
  // deducibles fiscalmente, ej. GMF 50%, multas, donaciones, etc).
  const { data: gastosNoDed } = await supabase
    .from("conciliacion_partidas")
    .select("valor, signo, tipo")
    .eq("declaracion_id", declId)
    .eq("tipo", "permanente")
    .eq("signo", "mas");
  const totalGastosNoDed = (gastosNoDed ?? []).reduce(
    (s, p) => s + Number(p.valor),
    0,
  );

  const input: ConcPatrimonialInput = {
    // Datos del año actual (F110 computado)
    patrimonioLiquidoActual: v(46),
    rentaLiquidaEjercicio: v(72), // antes de compensaciones (modelo Aries)
    impuestoNetoRenta: v(96),
    ingresosNoGravados: v(60),
    gananciaOcasionalBruta: v(80) - v(81),
    impuestoNetoGO: v(97) - v(98),

    // Año anterior
    patrimonioLiquidoAnterior: plAnterior,
    saldoPagarAnterior: num(declaracion.saldo_pagar_anterior),

    // Partidas automatizadas
    deduccionArt158_3: num(declaracion.deduccion_art_158_3),
    gastosNoDeducidos: totalGastosNoDed,

    // Manuales
    partidasManuales,

    // Primer año declarando
    esPrimerAno: declaracion.anios_declarando === "primero",
  };

  return computarConcPatrimonial(input);
}

/**
 * Variante simplificada · solo computa renta por comparación.
 * Mantenida por compat con `validaciones/page.tsx` que llama a
 * `loadRentaComparacionPatrimonial`.
 */
export async function loadRentaComparacionPatrimonial(
  supabase: SupabaseClient<Database>,
  declId: string,
  declaracion: DeclMin,
  valoresF110: Map<number, number>,
): Promise<{
  diferenciaPatrimonial: number;
  rentasAjustadas: number;
  rentaPorComparacion: number;
  esPrimeraVez: boolean;
  partidas: {
    valorizaciones: number;
    desvalorizaciones: number;
    normalizacionTributaria: number;
  };
}> {
  const r = await loadConcPatrimonial(supabase, declId, declaracion, valoresF110);
  const valorizaciones = r.justificantes
    .filter((j) => j.id.startsWith("manual-") && j.label.startsWith("Valorización"))
    .reduce((s, j) => s + j.valor, 0);
  const desvalorizaciones = r.restadores
    .filter((j) => j.id.startsWith("manual-") && j.label.startsWith("Desvalorización"))
    .reduce((s, j) => s + j.valor, 0);
  const normalizacionTributaria = r.justificantes
    .filter((j) => j.id.startsWith("manual-") && j.label.startsWith("Normalización"))
    .reduce((s, j) => s + j.valor, 0);
  return {
    diferenciaPatrimonial: Math.max(0, r.variacionBruta),
    rentasAjustadas: r.totalJustificantes,
    rentaPorComparacion: r.rentaPorComparacion,
    esPrimeraVez: r.estado === "no_aplica",
    partidas: { valorizaciones, desvalorizaciones, normalizacionTributaria },
  };
}
