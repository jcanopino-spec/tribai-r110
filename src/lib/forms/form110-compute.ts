// Formulas de los renglones computados del Formulario 110 AG 2025.
// Derivadas de las descripciones del propio formulario y verificadas contra
// las fórmulas del .xlsm fuente. Cuando el usuario edite renglones de input,
// los computados se recalculan en vivo en la UI. No se mapean cuentas
// contables a estos renglones.

export const RENGLONES_COMPUTADOS = new Set<number>([
  // Patrimonio
  44, // Total patrimonio bruto = sum(36..43)
  46, // Total patrimonio líquido = max(0, 44 - 45)
  // Ingresos
  58, // Total ingresos brutos = sum(47..57)
  61, // Total ingresos netos = max(0, 58 - 59 - 60)
  // Costos
  67, // Total costos y gastos deducibles = sum(62..66)
  // Renta
  72, // Renta líquida ordinaria = max(0, 61 + 69 + 70 + 71 - 52..56 - 67 - 68)
  73, // Pérdida líquida ordinaria (espejo de 72)
  75, // Renta líquida = max(0, 72 - 74)
  79, // Renta líquida gravable = max(75, 76) - 77 + 78
  // Ganancias ocasionales
  83, // Ganancias ocasionales gravables = max(0, 80 - 81 - 82)
  // Liquidación privada
  84, // Impuesto sobre la renta líquida gravable = 79 × tarifa del régimen
  91, // Total impuesto sobre rentas líquidas gravables = sum(84..90)
  97, // Impuesto neto de ganancias ocasionales = 83 × 15%
  108, // Anticipo año siguiente (Anexo 2 del .xlsm)
  94, // Impuesto neto de renta (sin adicionado) = 91 - 93 (+92 según descrip)
  96, // Impuesto neto de renta (con adicionado) = 94 + 95
  99, // Total impuesto a cargo = 96 + 97 - 98
  107, // Total retenciones = 105 + 106
  111, // Saldo a pagar por impuesto = 99 + 108 + 110 - 100..104 - 107 - 109
  112, // Total saldo a pagar = 99 + 108 + 110 + 113 - 100..104 - 107 - 109
  114, // Total saldo a favor = 100 + 101 + 102 + 103 + 104 + 107 + 109 - 99 - 108 - 110
]);

// Renglones que en el formulario 110 deben mostrarse siempre en valor
// positivo, aunque la cuenta contable subyacente tenga saldo crédito.
// - Pasivos (renglón 45): cuentas clase 2 vienen negativas en el TB.
// - Ingresos individuales (47..57): cuentas clase 4 vienen negativas.
// - Devoluciones, INCRNGO (59, 60): natural reductores de ingresos.
// - Costos individuales (62..66): suelen ser positivos pero forzamos por
//   consistencia con el formato del 110.
export const RENGLONES_POSITIVOS = new Set<number>([
  45,
  47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
  59, 60,
  62, 63, 64, 65, 66,
]);

const sum = (values: Map<number, number>, from: number, to: number) => {
  let s = 0;
  for (let n = from; n <= to; n++) s += values.get(n) ?? 0;
  return s;
};

// Tarifa fija para Ganancias Ocasionales (Art. 313 E.T., reformas posteriores).
// Para AG 2025 es 15% (Ley 2277 de 2022 elevó del 10% al 15%).
export const TARIFA_GANANCIAS_OCASIONALES = 0.15;

export type ComputeContext = {
  /** Tarifa del régimen del declarante (0..1). Si no se provee, 84 queda en 0. */
  tarifaRegimen?: number;
  /** Impuesto neto de renta del año gravable anterior (entrada del usuario). */
  impuestoNetoAnterior?: number;
  /** Años que la empresa lleva declarando, define la tarifa del anticipo. */
  aniosDeclarando?: "primero" | "segundo" | "tercero_o_mas";
};

const TARIFA_ANTICIPO: Record<NonNullable<ComputeContext["aniosDeclarando"]>, number> = {
  primero: 0.25,
  segundo: 0.5,
  tercero_o_mas: 0.75,
};

/**
 * Calcula los valores derivados a partir de los inputs.
 * No muta el mapa original. Devuelve un nuevo mapa con los computados aplicados.
 *
 * IMPORTANTE: el orden de cálculo importa porque hay computados que dependen
 * de otros computados (e.g., 79 usa 75; 84 usa 79; 91 usa 84; 96 usa 94).
 */
export function computarRenglones(
  valores: Map<number, number>,
  ctx: ComputeContext = {},
): Map<number, number> {
  const v = new Map<number, number>();
  // Normalizamos signo en la entrada: cualquier valor que llegue en un renglón
  // que el formulario espera positivo se convierte a abs() antes de calcular.
  // Esto cubre datos cargados antes de la normalización en escritura.
  for (const [n, val] of valores) v.set(n, normalizarSigno(n, val));
  const get = (n: number) => v.get(n) ?? 0;

  // --- Patrimonio ---
  const r44 = sum(v, 36, 43);
  v.set(44, r44);
  v.set(46, Math.max(0, r44 - get(45)));

  // --- Ingresos ---
  const r58 = sum(v, 47, 57);
  v.set(58, r58);
  v.set(61, Math.max(0, r58 - get(59) - get(60)));

  // --- Costos ---
  v.set(67, sum(v, 62, 66));

  // --- Renta líquida ordinaria / pérdida ---
  // 72 = max(0, 61 + 69 + 70 + 71 - 52 - 53 - 54 - 55 - 56 - 67 - 68)
  // 73 = espejo de 72 (cuando es negativo)
  // Las restas 52..56 son dividendos gravados a tarifas especiales que NO
  // entran a la renta ordinaria (se gravan aparte). 67 son costos totales.
  // 68 son inversiones ESAL del año.
  const baseRenta =
    get(61) + get(69) + get(70) + get(71) -
    get(52) - get(53) - get(54) - get(55) - get(56) -
    get(67) - get(68);
  v.set(72, Math.max(0, baseRenta));
  v.set(73, Math.max(0, -baseRenta));

  // --- Renta líquida ---
  // 75 = max(0, 72 - 74)
  v.set(75, Math.max(0, get(72) - get(74)));
  // 79 = max(75, 76) - 77 + 78  (Renta líquida gravable)
  //   "al mayor valor entre 75 y 76 reste 77 y sume 78"
  v.set(79, Math.max(get(75), get(76)) - get(77) + get(78));

  // --- Ganancias ocasionales ---
  // 83 = max(0, 80 - 81 - 82)
  v.set(83, Math.max(0, get(80) - get(81) - get(82)));

  // --- Liquidación privada ---
  // 84 = Renta líquida gravable × tarifa del régimen
  //   Si no hay tarifa configurada en la empresa, queda en 0 (input seguro).
  if (typeof ctx.tarifaRegimen === "number" && ctx.tarifaRegimen > 0) {
    v.set(84, Math.round(Math.max(0, get(79)) * ctx.tarifaRegimen));
  } else if (!v.has(84)) {
    v.set(84, 0);
  }
  // 97 = Ganancias ocasionales gravables × 15% (tarifa fija AG 2025)
  v.set(97, Math.round(Math.max(0, get(83)) * TARIFA_GANANCIAS_OCASIONALES));
  // 91 = sum(84..90)  (Total impuesto sobre rentas líquidas gravables)
  v.set(91, sum(v, 84, 90));
  // 94 = 91 + 92 - 93  (descripción: "91 + 92 - 93")
  v.set(94, get(91) + get(92) - get(93));
  // 96 = 94 + 95
  v.set(96, get(94) + get(95));
  // 99 = 96 + 97 - 98  (Total impuesto a cargo)
  v.set(99, get(96) + get(97) - get(98));
  // 107 = 105 + 106  (Total retenciones)
  v.set(107, get(105) + get(106));

  // 108 = Anticipo año siguiente (Anexo 2 del .xlsm, método 1 = promedio)
  //   = max(0, ((impuesto_neto_actual + impuesto_neto_anterior) / 2) × tarifa
  //          - retenciones)
  //   Primer año: 0 ("no aplica" según el .xlsm).
  if (
    typeof ctx.impuestoNetoAnterior === "number" &&
    typeof ctx.aniosDeclarando === "string"
  ) {
    if (ctx.aniosDeclarando === "primero") {
      v.set(108, 0);
    } else {
      const tarifa = TARIFA_ANTICIPO[ctx.aniosDeclarando];
      const promedio = (get(96) + ctx.impuestoNetoAnterior) / 2;
      const tentativo = Math.max(0, promedio * tarifa);
      v.set(108, Math.max(0, Math.round(tentativo - get(107))));
    }
  } else if (!v.has(108)) {
    v.set(108, 0);
  }

  // 111 = Saldo a pagar por impuesto
  //   = 99 + 108 + 110 - 100 - 101 - 102 - 103 - 104 - 107 - 109
  const restas = get(100) + get(101) + get(102) + get(103) + get(104) + get(107) + get(109);
  const r111 = get(99) + get(108) + get(110) - restas;
  v.set(111, Math.max(0, r111));

  // 112 = Total saldo a pagar
  //   = 99 + 108 + 110 + 113 - (mismo conjunto de restas)
  const r112 = get(99) + get(108) + get(110) + get(113) - restas;
  v.set(112, Math.max(0, r112));

  // 114 = Total saldo a favor (espejo de 112: si las restas exceden, hay saldo a favor)
  v.set(114, Math.max(0, restas - (get(99) + get(108) + get(110) + get(113))));

  return v;
}

/**
 * Pequeña descripción de cada fórmula para mostrar como subtítulo del renglón.
 */
export const FORMULAS_LEYENDA: Record<number, string> = {
  44: "Suma de 36 a 43",
  46: "44 − 45 (si positivo)",
  58: "Suma de 47 a 57",
  61: "58 − 59 − 60 (si positivo)",
  67: "Suma de 62 a 66",
  72: "61 + 69 + 70 + 71 − (52..56) − 67 − 68 (si positivo)",
  73: "Espejo de 72 (si la base es negativa)",
  75: "72 − 74 (si positivo)",
  79: "max(75, 76) − 77 + 78",
  83: "80 − 81 − 82 (si positivo)",
  84: "79 × tarifa del régimen",
  91: "Suma de 84 a 90",
  97: "83 × 15% (tarifa GO)",
  94: "91 + 92 − 93",
  96: "94 + 95",
  99: "96 + 97 − 98",
  107: "105 + 106",
  108: "(96 + impto. AG anterior) / 2 × tarifa años − 107",
  111: "99 + 108 + 110 − 100 − 101 − 102 − 103 − 104 − 107 − 109",
  112: "99 + 108 + 110 + 113 − (restas de 111)",
  114: "Diferencia (saldo a favor) si las restas exceden",
};

/**
 * Aplica las reglas del 110 al valor agregado de un renglón:
 * fuerza positivo cuando el formato lo exige (pasivos, ingresos, costos).
 * El balance puede traer saldos con su signo natural (crédito = negativo);
 * el formulario espera valores positivos en estos renglones.
 */
export function normalizarSigno(numero: number, valor: number): number {
  if (RENGLONES_POSITIVOS.has(numero)) return Math.abs(valor);
  return valor;
}
