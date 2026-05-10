// Engine puro · Conciliación Patrimonial (Art. 236 E.T.).
//
// Replica la estructura de la hoja "Conciliacion patrimonial" del archivo
// de actualicese.com (Diego Hernández) que es la referencia técnica más
// detallada en el mercado.
//
// El propósito del Art. 236 es DESVIRTUAR la renta presunta por
// comparación patrimonial: si el patrimonio líquido fiscal creció entre
// dic-31 año anterior y dic-31 año actual, ese crecimiento debe estar
// justificado por las rentas declaradas. Lo que no se justifica entra
// como adición a R78 del F110.
//
// FÓRMULA OFICIAL (modelo Aries / actualicese):
//
//   PL_justificado = PL_anterior
//                  + (Renta líquida ejercicio − Impuesto neto renta)
//                  + Ingresos no gravados (R60)
//                  + Deducción Art. 158-3 y similares
//                  + (Ganancia ocasional − Impuesto neto GO)
//                  + Partidas manuales que justifican (valorizaciones, normalización)
//                  − Gastos NO deducidos en renta fiscal
//                  − Partidas manuales que NO justifican (desvalorizaciones)
//
//   Diferencia_por_justificar = PL_declarado − PL_justificado
//   Renta por comparación     = max(0, Diferencia_por_justificar)
//
// La "deducción Art. 158-3" merece explicación: es un valor que rebaja
// la renta líquida fiscal pero NO disminuyó el patrimonio (porque la
// inversión sigue en el balance). Por eso suma al justificado.
//
// Los "gastos no deducidos en renta fiscal" son partidas que SÍ salieron
// del patrimonio contable (gastos reales) aunque fiscalmente NO se
// dedujeron (multas, GMF 50%, etc). Por eso restan al justificado.

export const TOLERANCIA = 1;

export type PartidaManualPatrimonial = {
  id: string | number;
  signo: "mas" | "menos";
  concepto: string;
  valor: number;
  observacion?: string | null;
  /**
   * Bucket semántico (heurística por keyword del concepto):
   *   valorizacion / desvalorizacion · ajustes de valor de activos
   *   normalizacion · normalización tributaria Ley 2010
   *   otra · cualquier otra captura manual
   */
  bucket?: "valorizacion" | "desvalorizacion" | "normalizacion" | "otra";
};

export type ConcPatrimonialInput = {
  // Datos del año actual (del F110 computado)
  patrimonioLiquidoActual: number; // R46
  rentaLiquidaEjercicio: number; // R72 (antes de compensaciones)
  impuestoNetoRenta: number; // R96
  ingresosNoGravados: number; // R60
  gananciaOcasionalBruta: number; // R80 − R81 (sin restar R82 GO no gravada)
  impuestoNetoGO: number; // R97 − R98

  // Datos del año anterior
  patrimonioLiquidoAnterior: number;
  saldoPagarAnterior: number;

  // Partidas automatizadas desde otros módulos
  deduccionArt158_3: number; // Deducción especial activos fijos productores de renta
  gastosNoDeducidos: number; // Suma de partidas `gastos_no_deducibles` de Conc Utilidades

  // Partidas manuales del usuario (valorizaciones, normalización, etc)
  partidasManuales: PartidaManualPatrimonial[];

  // Flag · primer año declarando (Art. 237 · no aplica comparación patrimonial)
  esPrimerAno: boolean;
};

export type Justificante = {
  id: string;
  label: string;
  valor: number;
  origen: "F110" | "anexo" | "manual" | "calc";
};

export type ConcPatrimonialResultado = {
  // Insumos clave
  plAnterior: number;
  plActual: number;
  variacionBruta: number; // plActual − plAnterior (sin tope a 0)

  // Detalle de justificantes (suman)
  justificantes: Justificante[];
  totalJustificantes: number;

  // Detalle de restadores (NO justifican)
  restadores: Justificante[];
  totalRestadores: number;

  // Cómputo final
  plJustificado: number; // plAnterior + totalJustificantes − totalRestadores
  diferenciaPorJustificar: number; // plActual − plJustificado
  rentaPorComparacion: number; // max(0, diferenciaPorJustificar)

  // Estado
  cuadra: boolean; // |diferencia| ≤ TOLERANCIA
  estado: "cuadrado" | "renta_presunta" | "no_aplica";
};

/**
 * Cómputo de la conciliación patrimonial según el modelo Aries.
 * Función pura · totalmente testeable.
 */
export function computarConcPatrimonial(
  input: ConcPatrimonialInput,
): ConcPatrimonialResultado {
  const plAnterior = input.patrimonioLiquidoAnterior;
  const plActual = input.patrimonioLiquidoActual;
  const variacionBruta = plActual - plAnterior;

  // Primer año declarando: Art. 237 E.T. no aplica · todo se considera justificado
  if (input.esPrimerAno) {
    return {
      plAnterior,
      plActual,
      variacionBruta,
      justificantes: [],
      totalJustificantes: 0,
      restadores: [],
      totalRestadores: 0,
      plJustificado: plActual, // por convención · todo justificado
      diferenciaPorJustificar: 0,
      rentaPorComparacion: 0,
      cuadra: true,
      estado: "no_aplica",
    };
  }

  // Justificantes (suman al PL justificado)
  const justificantes: Justificante[] = [];

  // 1. Renta líquida ejercicio − Impuesto neto de renta
  const rentaNetaDeImp = input.rentaLiquidaEjercicio - input.impuestoNetoRenta;
  if (rentaNetaDeImp !== 0) {
    justificantes.push({
      id: "renta_neta",
      label: "Renta líquida del ejercicio − Impuesto neto de renta",
      valor: rentaNetaDeImp,
      origen: "F110",
    });
  }

  // 2. Ingresos no constitutivos de renta (R60)
  if (input.ingresosNoGravados !== 0) {
    justificantes.push({
      id: "incrngo",
      label: "Ingresos no gravados (R60)",
      valor: input.ingresosNoGravados,
      origen: "F110",
    });
  }

  // 3. Deducción Art. 158-3 y similares
  // Son deducciones que rebajan la renta fiscal pero NO disminuyeron el patrimonio
  // (porque la inversión sigue en el balance). Por eso suman al justificado.
  if (input.deduccionArt158_3 !== 0) {
    justificantes.push({
      id: "art_158_3",
      label: "Deducción Art. 158-3 y similares (inversión activos fijos productores)",
      valor: input.deduccionArt158_3,
      origen: "anexo",
    });
  }

  // 4. Ganancia ocasional − Impuesto neto GO
  const goNetaImp = input.gananciaOcasionalBruta - input.impuestoNetoGO;
  if (goNetaImp !== 0) {
    justificantes.push({
      id: "go_neta",
      label: "Ganancia ocasional − Impuesto neto GO",
      valor: goNetaImp,
      origen: "F110",
    });
  }

  // 5. Partidas manuales que suman (valorizaciones, normalización, signo=mas otra)
  for (const p of input.partidasManuales) {
    if (p.signo === "mas") {
      justificantes.push({
        id: `manual-${p.id}`,
        label: `${labelBucket(p)}: ${p.concepto}`,
        valor: p.valor,
        origen: "manual",
      });
    }
  }

  const totalJustificantes = justificantes.reduce((s, j) => s + j.valor, 0);

  // Restadores (NO justifican · restan al PL justificado)
  const restadores: Justificante[] = [];

  // 6. Gastos NO deducidos en renta fiscal (de Conc Utilidades · gastos no deducibles)
  // Estos sí salieron del patrimonio contablemente aunque fiscalmente no se restaron.
  if (input.gastosNoDeducidos !== 0) {
    restadores.push({
      id: "gastos_no_deducidos",
      label: "Gastos NO deducidos en renta fiscal (multas, GMF 50%, donaciones, etc)",
      valor: input.gastosNoDeducidos,
      origen: "anexo",
    });
  }

  // 7. Saldo a pagar año anterior (efectivamente pagado este año → salió del patrimonio)
  if (input.saldoPagarAnterior > 0) {
    restadores.push({
      id: "saldo_pagar_anterior",
      label: "Saldo a pagar año anterior (impuesto efectivamente pagado)",
      valor: input.saldoPagarAnterior,
      origen: "F110",
    });
  }

  // 8. Partidas manuales que restan (desvalorizaciones, signo=menos otra)
  for (const p of input.partidasManuales) {
    if (p.signo === "menos") {
      restadores.push({
        id: `manual-${p.id}`,
        label: `${labelBucket(p)}: ${p.concepto}`,
        valor: p.valor,
        origen: "manual",
      });
    }
  }

  const totalRestadores = restadores.reduce((s, r) => s + r.valor, 0);

  // PL justificado = PL anterior + justificantes − restadores
  const plJustificado = plAnterior + totalJustificantes - totalRestadores;
  const diferenciaPorJustificar = plActual - plJustificado;
  const rentaPorComparacion = Math.max(0, diferenciaPorJustificar);
  const cuadra = Math.abs(diferenciaPorJustificar) <= TOLERANCIA;

  return {
    plAnterior,
    plActual,
    variacionBruta,
    justificantes,
    totalJustificantes,
    restadores,
    totalRestadores,
    plJustificado,
    diferenciaPorJustificar,
    rentaPorComparacion,
    cuadra,
    estado: cuadra
      ? "cuadrado"
      : rentaPorComparacion > 0
        ? "renta_presunta"
        : "cuadrado",
  };
}

function labelBucket(p: PartidaManualPatrimonial): string {
  switch (p.bucket) {
    case "valorizacion":
      return "Valorización";
    case "desvalorizacion":
      return "Desvalorización";
    case "normalizacion":
      return "Normalización tributaria";
    default:
      return p.signo === "mas" ? "Otra partida (+)" : "Otra partida (−)";
  }
}

/**
 * Clasifica un concepto manual en su bucket según keywords.
 * Mantiene la lógica de la página actual (heurística por substring).
 */
export function clasificarBucket(
  concepto: string,
  signo: "mas" | "menos",
): PartidaManualPatrimonial["bucket"] {
  const c = concepto.toLowerCase();
  if (/desvalorizaci/.test(c)) return "desvalorizacion";
  if (/valorizaci/.test(c)) return "valorizacion";
  if (/normalizaci/.test(c)) return "normalizacion";
  return "otra";
}
