// Sanciones del Estatuto Tributario aplicables al Formulario 110:
// - Art. 641 / 642: extemporaneidad (sin / con emplazamiento)
// - Art. 644: corrección
// - Art. 640: reducción de sanciones
// - Art. 639: sanción mínima 10 UVT

/** Sanción mínima en UVT (Art. 639 E.T.) */
export const SANCION_MINIMA_UVT = 10;

/**
 * Calcula la sanción por extemporaneidad según Art. 641 (sin emplazamiento)
 * o Art. 642 E.T. (con emplazamiento). Aplica reducción del Art. 640 si procede.
 *
 * Cuando hay impuesto a cargo: % por mes/fracción sobre el impuesto, con tope.
 * Si no hay impuesto pero sí ingresos: % sobre ingresos brutos.
 * Si no hay ingresos: % sobre patrimonio líquido del año anterior.
 *
 * Sanción mínima 10 UVT (Art. 639 E.T.) cuando supera 0.
 */
export function calcularSancionExtemporaneidad(args: {
  meses: number;
  impuestoCargo: number;
  ingresosBrutos: number;
  patrimonioLiquidoAnterior: number;
  uvt: number;
  existeEmplazamiento: boolean;
  reduccion: "0" | "50" | "75";
}): number {
  const {
    meses,
    impuestoCargo,
    ingresosBrutos,
    patrimonioLiquidoAnterior,
    uvt,
    existeEmplazamiento,
    reduccion,
  } = args;
  if (meses <= 0 || uvt <= 0) return 0;

  let base = 0;
  if (existeEmplazamiento) {
    // Art. 642 E.T.
    if (impuestoCargo > 0) {
      base = Math.min(0.10 * meses * impuestoCargo, 2 * impuestoCargo);
    } else if (ingresosBrutos > 0) {
      base = Math.min(
        0.01 * meses * ingresosBrutos,
        0.10 * ingresosBrutos,
        10000 * uvt,
      );
    } else if (patrimonioLiquidoAnterior > 0) {
      base = Math.min(
        0.02 * meses * patrimonioLiquidoAnterior,
        0.20 * patrimonioLiquidoAnterior,
        5000 * uvt,
      );
    }
  } else {
    // Art. 641 E.T.
    if (impuestoCargo > 0) {
      // 5% por mes/fracción, sin exceder del 100% del impuesto
      base = Math.min(0.05 * meses * impuestoCargo, impuestoCargo);
    } else if (ingresosBrutos > 0) {
      // 0.5% por mes, tope: 5% de ingresos o 2.500 UVT (cuando no hay saldo a favor)
      base = Math.min(
        0.005 * meses * ingresosBrutos,
        0.05 * ingresosBrutos,
        2500 * uvt,
      );
    } else if (patrimonioLiquidoAnterior > 0) {
      // 1% por mes, tope: 10% del patrimonio o 2.500 UVT
      base = Math.min(
        0.01 * meses * patrimonioLiquidoAnterior,
        0.10 * patrimonioLiquidoAnterior,
        2500 * uvt,
      );
    }
  }

  if (base <= 0) return 0;

  // Reducción Art. 640 E.T.
  const factorReduccion = 1 - Number(reduccion) / 100;
  const conReduccion = base * factorReduccion;

  // Sanción mínima 10 UVT
  const minima = SANCION_MINIMA_UVT * uvt;
  return Math.round(Math.max(minima, conReduccion));
}

/**
 * Sanción por corrección (Art. 644 E.T.):
 * - Sin emplazamiento: 10% del mayor valor a pagar o menor saldo a favor
 * - Con emplazamiento: 20% del mayor valor
 * - Reducción Art. 640 (0/50/75)
 * - Sanción mínima 10 UVT
 */
export function calcularSancionCorreccion(args: {
  mayorValor: number;
  uvt: number;
  existeEmplazamiento: boolean;
  reduccion: "0" | "50" | "75";
}): number {
  const { mayorValor, uvt, existeEmplazamiento, reduccion } = args;
  if (mayorValor <= 0 || uvt <= 0) return 0;

  const tarifa = existeEmplazamiento ? 0.20 : 0.10;
  const base = mayorValor * tarifa;
  const factorReduccion = 1 - Number(reduccion) / 100;
  const conReduccion = base * factorReduccion;
  const minima = SANCION_MINIMA_UVT * uvt;
  return Math.round(Math.max(minima, conReduccion));
}
