// Formulas de los renglones computados del Formulario 110 AG 2025.
// Derivadas de las descripciones del propio formulario y verificadas contra
// las fórmulas del .xlsm fuente. Cuando el usuario edite renglones de input,
// los computados se recalculan en vivo en la UI. No se mapean cuentas
// contables a estos renglones.

export const RENGLONES_COMPUTADOS = new Set<number>([
  // Datos informativos · nómina (vienen de /configuracion tab Otros)
  33, // Total costos y gastos de nómina
  34, // Aportes al sistema de seguridad social
  35, // Aportes al SENA, ICBF, cajas
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
  85, // Sobretasa instituciones financieras (Par. 1° Art. 240 E.T.)
  91, // Total impuesto sobre rentas líquidas gravables = sum(84..90)
  97, // Impuesto neto de ganancias ocasionales = 83 × 15%
  105, // Autorretenciones · viene del Anexo 3
  106, // Otras retenciones · viene del Anexo 3
  108, // Anticipo año siguiente (Anexo 2 del .xlsm)
  113, // Sanción por extemporaneidad (Arts. 641/642 E.T.)
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
  /** Estado de presentación calculado en /lib/forms/vencimientos.ts */
  presentacion?: { estado: "no_presentada" | "oportuna" | "extemporanea"; mesesExtemporanea?: number };
  /** Flag de sanción extemporaneidad activado por el usuario */
  calculaSancionExtemporaneidad?: boolean;
  /** Flag de sanción por corrección activado */
  calculaSancionCorreccion?: boolean;
  /** Mayor valor a pagar / menor saldo a favor por la corrección */
  mayorValorCorreccion?: number;
  /** ¿Existe emplazamiento previo? Cambia las tarifas del Art. 641 → 642 E.T. */
  existeEmplazamiento?: boolean;
  /** Reducción del Art. 640 E.T.: '0' | '50' | '75' */
  reduccionSancion?: "0" | "50" | "75";
  /** UVT vigente para la liquidación de la sanción (año de presentación). */
  uvtVigente?: number;
  /** Patrimonio líquido año gravable anterior (para sanción cuando no hay impuesto/ingresos). */
  patrimonioLiquidoAnterior?: number;
  /** ¿Es institución financiera/aseguradora/hidroeléctrica/extractora? Activa sobretasa. */
  esInstitucionFinanciera?: boolean;
  /** Datos de nómina (vienen de /configuracion tab Otros) */
  totalNomina?: number;
  aportesSegSocial?: number;
  aportesParaFiscales?: number;
  /** Anexo 3 · totales de retenciones y autorretenciones */
  totalAutorretenciones?: number;
  totalRetenciones?: number;
};

const TARIFA_ANTICIPO: Record<NonNullable<ComputeContext["aniosDeclarando"]>, number> = {
  primero: 0.25,
  segundo: 0.5,
  tercero_o_mas: 0.75,
};

// Sanción mínima: 10 UVT (Art. 639 E.T.)
const SANCION_MINIMA_UVT = 10;

// Umbral en UVT para aplicar sobretasa de instituciones financieras
// (Par. 1° Art. 240 E.T., 5 puntos adicionales sobre el exceso)
const UMBRAL_SOBRETASA_UVT = 120000;
const PUNTOS_SOBRETASA = 0.05;

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
  const { meses, impuestoCargo, ingresosBrutos, patrimonioLiquidoAnterior, uvt, existeEmplazamiento, reduccion } = args;
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
      base = Math.min(0.05 * meses * impuestoCargo, impuestoCargo);
    } else if (ingresosBrutos > 0) {
      base = Math.min(
        0.005 * meses * ingresosBrutos,
        0.05 * ingresosBrutos,
        5000 * uvt,
      );
    } else if (patrimonioLiquidoAnterior > 0) {
      base = Math.min(
        0.01 * meses * patrimonioLiquidoAnterior,
        0.01 * patrimonioLiquidoAnterior,
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

  // --- Datos informativos · nómina (sólo si se proveyeron, sino mantienen el valor previo en DB) ---
  if (typeof ctx.totalNomina === "number") v.set(33, ctx.totalNomina);
  if (typeof ctx.aportesSegSocial === "number") v.set(34, ctx.aportesSegSocial);
  if (typeof ctx.aportesParaFiscales === "number") v.set(35, ctx.aportesParaFiscales);

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

  // 85 = Sobretasa instituciones financieras (Par. 1° Art. 240 E.T.)
  //   5 puntos porcentuales adicionales sobre la renta líquida gravable
  //   que exceda 120.000 UVT.
  if (
    ctx.esInstitucionFinanciera &&
    typeof ctx.uvtVigente === "number" &&
    ctx.uvtVigente > 0
  ) {
    const rentaGravable = Math.max(0, get(79));
    const umbral = UMBRAL_SOBRETASA_UVT * ctx.uvtVigente;
    const exceso = Math.max(0, rentaGravable - umbral);
    v.set(85, Math.round(exceso * PUNTOS_SOBRETASA));
  } else {
    v.set(85, 0);
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
  // 105 = Total autorretenciones (suma del Anexo 3)
  if (typeof ctx.totalAutorretenciones === "number") {
    v.set(105, ctx.totalAutorretenciones);
  }
  // 106 = Total retenciones (suma del Anexo 3)
  if (typeof ctx.totalRetenciones === "number") {
    v.set(106, ctx.totalRetenciones);
  }
  // 107 = 105 + 106  (Total retenciones)
  v.set(107, get(105) + get(106));

  // 113 = Sanción total = extemporaneidad + corrección
  let sancionExt = 0;
  if (
    ctx.calculaSancionExtemporaneidad &&
    ctx.presentacion?.estado === "extemporanea" &&
    typeof ctx.uvtVigente === "number"
  ) {
    sancionExt = calcularSancionExtemporaneidad({
      meses: ctx.presentacion.mesesExtemporanea ?? 0,
      impuestoCargo: Math.max(0, get(99)),
      ingresosBrutos: get(58),
      patrimonioLiquidoAnterior: ctx.patrimonioLiquidoAnterior ?? 0,
      uvt: ctx.uvtVigente,
      existeEmplazamiento: !!ctx.existeEmplazamiento,
      reduccion: ctx.reduccionSancion ?? "0",
    });
  }
  let sancionCorr = 0;
  if (
    ctx.calculaSancionCorreccion &&
    typeof ctx.uvtVigente === "number" &&
    typeof ctx.mayorValorCorreccion === "number"
  ) {
    sancionCorr = calcularSancionCorreccion({
      mayorValor: ctx.mayorValorCorreccion,
      uvt: ctx.uvtVigente,
      existeEmplazamiento: !!ctx.existeEmplazamiento,
      reduccion: ctx.reduccionSancion ?? "0",
    });
  }
  v.set(113, sancionExt + sancionCorr);

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
 * Notas contextuales de algunos renglones (regulación, alcance, advertencias).
 * Aparecen como tooltip o subtítulo gris bajo la descripción del renglón.
 */
export const NOTAS_RENGLON: Record<number, string> = {
  76:
    "Para AG 2024+ la renta presuntiva es 0% (Ley 2277/2022 mantuvo la base en 0). " +
    "Solo digitar si tienes obligaciones específicas que la mantengan.",
  85:
    "Sobretasa: aplica a entidades financieras (Art. 240 par. 1° E.T.), extractoras de petróleo, " +
    "carbón y a generadoras hidroeléctricas. No aplica a la mayoría de PJ del régimen ordinario.",
  86:
    "Dividendos gravados a la tarifa del 10%. Solo si tienes dividendos en esa categoría específica.",
  87:
    "Dividendos gravados a la tarifa del Art. 245 E.T. (no residentes / 35%). Categoría especial.",
  88:
    "Dividendos gravados a la tarifa del 20% (Ley 1819/2016 antes de Ley 2277/2022). Casos transitorios.",
  89:
    "Dividendos gravados a la tarifa del 35%. Aplicable según condiciones del Art. 240 E.T.",
  90:
    "Dividendos gravados a la tarifa del 33% (categoría histórica). Solo si aplica.",
  92:
    "Valor adicional (VAA): ajustes positivos al impuesto sobre la renta. Casos especiales.",
  95:
    "Impuesto a adicionar (IA): ajustes complementarios. Casos especiales.",
  100:
    "Inversión en obras por impuestos (Modalidad de pago 1): hasta 50% del impuesto neto. Decreto 1915/2017.",
  101:
    "Descuento efectivo por obras por impuestos (Modalidad de pago 2): por la inversión efectivamente girada.",
  102:
    "Crédito fiscal por inversión en investigación, desarrollo e innovación (Art. 256-1 E.T.).",
};

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
  85: "5% sobre exceso de 79 sobre 120.000 UVT (instituciones financieras)",
  91: "Suma de 84 a 90",
  97: "83 × 15% (tarifa GO)",
  94: "91 + 92 − 93",
  96: "94 + 95",
  99: "96 + 97 − 98",
  105: "Suma de autorretenciones (Anexo 3)",
  106: "Suma de retenciones (Anexo 3)",
  107: "105 + 106",
  108: "(96 + impto. AG anterior) / 2 × tarifa años − 107",
  113: "Sanciones (extemporaneidad + corrección, Arts. 641/642/644)",
  111: "99 + 108 + 110 − 100 − 101 − 102 − 103 − 104 − 107 − 109",
  112: "99 + 108 + 110 + 113 − (restas de 111)",
  114: "Diferencia (saldo a favor) si las restas exceden",
};

// ============================================================
// Beneficio de auditoría · Art. 689-3 E.T.
// ============================================================

export type BeneficioAuditoria = {
  /** Plazo de firmeza efectivo en meses (12, 6 o 36 = sin beneficio = firmeza ordinaria 3 años). */
  mesesFirmeza: number;
  /** ¿Cumple los requisitos? */
  cumpleRequisitos: boolean;
  /** Incremento porcentual del impuesto neto vs el año anterior (0..1). */
  incremento: number;
  /** Razón por la que no aplica si cumpleRequisitos = false. */
  razon: string | null;
};

/**
 * Evalúa si la declaración cumple los requisitos para el beneficio de auditoría
 * del Art. 689-3 E.T. AG 2025:
 * - 12 meses de firmeza si impuesto_neto_actual ≥ 25% más que el del año anterior.
 * - 6 meses de firmeza si impuesto_neto_actual ≥ 35% más.
 * - Adicionalmente, el impuesto del año anterior debe ser >= 71 UVT (sancion mínima * 7).
 *   Para simplificar usamos un umbral mínimo de impuesto AG anterior > 0.
 * - La declaración debe presentarse dentro del plazo legal (oportuna, no extemporánea).
 */
export function evaluarBeneficioAuditoria(args: {
  impuestoNetoActual: number;
  impuestoNetoAnterior: number;
  pidio12m: boolean;
  pidio6m: boolean;
  presentacionOportuna: boolean;
}): BeneficioAuditoria {
  const { impuestoNetoActual, impuestoNetoAnterior, pidio12m, pidio6m, presentacionOportuna } = args;

  if (!pidio12m && !pidio6m) {
    return { mesesFirmeza: 36, cumpleRequisitos: true, incremento: 0, razon: null };
  }

  if (impuestoNetoAnterior <= 0) {
    return {
      mesesFirmeza: 36,
      cumpleRequisitos: false,
      incremento: 0,
      razon: "El impuesto neto del año gravable anterior es cero o no se registró.",
    };
  }

  if (!presentacionOportuna) {
    return {
      mesesFirmeza: 36,
      cumpleRequisitos: false,
      incremento: 0,
      razon: "La declaración no se presentó oportunamente. El beneficio requiere presentación dentro del plazo.",
    };
  }

  const incremento = (impuestoNetoActual - impuestoNetoAnterior) / impuestoNetoAnterior;

  if (pidio6m) {
    if (incremento >= 0.35) {
      return { mesesFirmeza: 6, cumpleRequisitos: true, incremento, razon: null };
    }
    if (pidio12m && incremento >= 0.25) {
      return { mesesFirmeza: 12, cumpleRequisitos: true, incremento, razon: null };
    }
    return {
      mesesFirmeza: 36,
      cumpleRequisitos: false,
      incremento,
      razon: `Incremento del ${(incremento * 100).toFixed(2)}% es menor al 35% requerido para 6 meses de firmeza.`,
    };
  }

  // Solo pidió 12 meses
  if (incremento >= 0.25) {
    return { mesesFirmeza: 12, cumpleRequisitos: true, incremento, razon: null };
  }
  return {
    mesesFirmeza: 36,
    cumpleRequisitos: false,
    incremento,
    razon: `Incremento del ${(incremento * 100).toFixed(2)}% es menor al 25% requerido para 12 meses de firmeza.`,
  };
}

// ============================================================
// Validaciones del 110
// ============================================================

export type Validacion = {
  nivel: "info" | "warn" | "error";
  renglon?: number;
  mensaje: string;
  categoria: "configuracion" | "cuadre" | "sanidad" | "completitud" | "fiscal";
};

export function validarFormulario(
  numerico: Map<number, number>,
  ctx: {
    tarifaRegimen?: number | null;
    impuestoNetoAnterior?: number;
    aniosDeclarando?: string;
    presentacion?: { estado: "no_presentada" | "oportuna" | "extemporanea"; mesesExtemporanea?: number };
    calculaSancionExtemporaneidad?: boolean;
    beneficioAuditoria12m?: boolean;
    beneficioAuditoria6m?: boolean;
  } = {},
): Validacion[] {
  const get = (n: number) => numerico.get(n) ?? 0;
  const out: Validacion[] = [];

  // Configuración
  if (ctx.tarifaRegimen == null) {
    out.push({
      categoria: "configuracion",
      nivel: "error",
      mensaje: "Esta empresa no tiene régimen tributario configurado. El renglón 84 quedará en 0.",
    });
  }

  // Cuadre patrimonial
  if (get(44) < get(45)) {
    out.push({
      categoria: "cuadre",
      nivel: "warn",
      renglon: 46,
      mensaje: "Patrimonio bruto (44) es menor que pasivos (45). El patrimonio líquido queda en 0.",
    });
  }

  if (get(44) === 0 && get(45) === 0) {
    out.push({
      categoria: "completitud",
      nivel: "warn",
      renglon: 44,
      mensaje: "No tienes patrimonio bruto ni pasivos. Verifica el balance importado.",
    });
  }

  // Cuadre operativo (ingresos / costos / renta)
  if (get(67) > get(58) && get(58) > 0) {
    out.push({
      categoria: "sanidad",
      nivel: "info",
      renglon: 73,
      mensaje:
        "Los costos (67) superan los ingresos brutos (58). Probablemente hay pérdida líquida.",
    });
  }

  if (get(73) > 0) {
    out.push({
      categoria: "fiscal",
      nivel: "info",
      renglon: 73,
      mensaje:
        "Tienes pérdida líquida del ejercicio. Puedes compensar contra futuras rentas líquidas vía renglón 74.",
    });
  }

  if (get(72) > 0 && get(74) > get(72)) {
    out.push({
      categoria: "fiscal",
      nivel: "warn",
      renglon: 74,
      mensaje:
        "Compensaciones (74) superan la renta líquida (72). Solo se compensa hasta el monto disponible.",
    });
  }

  // Renta exenta no puede superar renta líquida
  if (get(77) > Math.max(get(75), get(76))) {
    out.push({
      categoria: "fiscal",
      nivel: "error",
      renglon: 77,
      mensaje:
        "Renta exenta (77) supera el mayor entre renta líquida (75) y presuntiva (76). Verifica.",
    });
  }

  // Devoluciones razonables vs ingresos
  if (get(59) > get(58)) {
    out.push({
      categoria: "sanidad",
      nivel: "warn",
      renglon: 59,
      mensaje:
        "Devoluciones, rebajas y descuentos (59) superan los ingresos brutos (58). Verifica el signo y los datos.",
    });
  }

  // INCRNGO razonable vs ingresos
  if (get(60) > get(58)) {
    out.push({
      categoria: "sanidad",
      nivel: "warn",
      renglon: 60,
      mensaje:
        "Ingresos no constitutivos (60) superan los ingresos brutos (58). Verifica el dato.",
    });
  }

  // Sin renta gravable
  if (get(79) === 0 && get(76) === 0 && get(72) === 0) {
    out.push({
      categoria: "completitud",
      nivel: "info",
      renglon: 79,
      mensaje: "No hay renta líquida gravable. El impuesto será 0.",
    });
  }

  // Renta gravable sin tarifa
  if (get(79) > 0 && (ctx.tarifaRegimen ?? 0) === 0) {
    out.push({
      categoria: "configuracion",
      nivel: "error",
      renglon: 84,
      mensaje:
        "Hay renta líquida gravable pero la tarifa del régimen es 0. Configura el régimen de la empresa.",
    });
  }

  // Descuentos > impuesto
  if (get(93) > get(91)) {
    out.push({
      categoria: "fiscal",
      nivel: "error",
      renglon: 93,
      mensaje:
        "Descuentos tributarios (93) superan el impuesto (91). El impuesto neto no puede ser negativo.",
    });
  }

  // Ganancias ocasionales
  if (get(83) > 0 && get(97) === 0) {
    out.push({
      categoria: "completitud",
      nivel: "info",
      renglon: 97,
      mensaje:
        "Tienes ganancias ocasionales gravables (83) pero el impuesto GO (97) es 0. Verifica el cálculo.",
    });
  }

  // Impuesto a cargo sin retenciones / anticipos
  if (get(99) > 0 && get(107) === 0 && get(103) === 0 && get(104) === 0) {
    out.push({
      categoria: "completitud",
      nivel: "info",
      renglon: 111,
      mensaje:
        "Tienes impuesto a cargo pero no registras retenciones, anticipos ni saldo a favor. Verifica antes de cerrar.",
    });
  }

  // Anticipo
  if (
    ctx.aniosDeclarando &&
    ctx.aniosDeclarando !== "primero" &&
    (ctx.impuestoNetoAnterior ?? 0) === 0
  ) {
    out.push({
      categoria: "completitud",
      nivel: "warn",
      renglon: 108,
      mensaje:
        "El impuesto neto del año gravable anterior está en 0. El anticipo se calcula como 50% del impuesto actual / 2; verifica si es correcto.",
    });
  }

  // Anticipo año siguiente sospechosamente alto
  if (get(108) > get(99) * 2) {
    out.push({
      categoria: "sanidad",
      nivel: "warn",
      renglon: 108,
      mensaje:
        "El anticipo del año siguiente (108) es más del doble del impuesto a cargo (99). Verifica los inputs.",
    });
  }

  // Saldo positivo y a favor a la vez (imposible)
  if (get(112) > 0 && get(114) > 0) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      mensaje: "Hay simultáneamente saldo a pagar y saldo a favor. Es imposible; revisa los datos.",
    });
  }

  // Vencimiento / extemporaneidad
  if (ctx.presentacion?.estado === "extemporanea") {
    const meses = ctx.presentacion.mesesExtemporanea ?? 0;
    if (!ctx.calculaSancionExtemporaneidad) {
      out.push({
        categoria: "fiscal",
        nivel: "error",
        mensaje:
          `La declaración se presentó ${meses} mes${meses !== 1 ? "es" : ""} después del vencimiento. ` +
          "Activa 'Calcular sanción por extemporaneidad' en /configuracion para liquidar la sanción correspondiente.",
      });
    } else {
      out.push({
        categoria: "fiscal",
        nivel: "warn",
        mensaje:
          `Declaración extemporánea: ${meses} mes${meses !== 1 ? "es" : ""} de retraso. La sanción del Art. 641 E.T. se calcula sobre el impuesto a cargo o ingresos brutos.`,
      });
    }
  }

  if (ctx.presentacion?.estado === "no_presentada") {
    out.push({
      categoria: "completitud",
      nivel: "info",
      mensaje:
        "Sin fecha de presentación registrada. Configúrala en /configuracion (tab Sanciones) para evaluar oportunidad.",
    });
  }

  // Beneficio de auditoría
  if (ctx.beneficioAuditoria12m || ctx.beneficioAuditoria6m) {
    const ben = evaluarBeneficioAuditoria({
      impuestoNetoActual: get(96),
      impuestoNetoAnterior: ctx.impuestoNetoAnterior ?? 0,
      pidio12m: !!ctx.beneficioAuditoria12m,
      pidio6m: !!ctx.beneficioAuditoria6m,
      presentacionOportuna: ctx.presentacion?.estado === "oportuna",
    });
    if (ben.cumpleRequisitos) {
      out.push({
        categoria: "fiscal",
        nivel: "info",
        mensaje:
          `Beneficio de auditoría aplicable: firmeza de ${ben.mesesFirmeza} meses ` +
          `(incremento del impuesto neto del ${(ben.incremento * 100).toFixed(2)}% vs AG anterior).`,
      });
    } else {
      out.push({
        categoria: "fiscal",
        nivel: "warn",
        mensaje:
          `Beneficio de auditoría no cumple los requisitos del Art. 689-3 E.T. ` +
          `${ben.razon ?? ""} La firmeza será la ordinaria (3 años).`,
      });
    }
  }

  return out;
}

/**
 * Resumen de validaciones por nivel.
 */
export function resumenValidaciones(v: Validacion[]) {
  return {
    errores: v.filter((x) => x.nivel === "error").length,
    advertencias: v.filter((x) => x.nivel === "warn").length,
    informativas: v.filter((x) => x.nivel === "info").length,
    bloqueante: v.some((x) => x.nivel === "error"),
  };
}

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
