// Núcleo del cómputo del Formulario 110 AG 2025.
// Toma los inputs editados por el usuario + los totales de los anexos en
// `ComputeContext` y devuelve el mapa numérico con todos los renglones
// derivados. No muta el mapa de entrada.

import { normalizarSigno, sumRango, redondearDIAN } from "./utils";
import {
  calcularSancionExtemporaneidad,
  calcularSancionCorreccion,
} from "./sanciones";
import { calcularImpuestoAdicionar } from "./tasa-minima";

export const RENGLONES_COMPUTADOS = new Set<number>([
  // Datos informativos · nómina (vienen de /configuracion tab Otros)
  33, // Total costos y gastos de nómina
  34, // Aportes al sistema de seguridad social
  35, // Aportes al SENA, ICBF, cajas
  // Patrimonio
  44, // Total patrimonio bruto = sum(36..43)
  46, // Total patrimonio líquido = max(0, 44 - 45)
  // Ingresos · dividendos (vienen del Anexo 18)
  49, 50, 51, 52, 53, 54, 55, 56,
  // Ingresos
  58, // Total ingresos brutos = sum(47..57)
  60, // INCRNGO · viene del Anexo 26
  61, // Total ingresos netos = max(0, 58 - 59 - 60)
  // Costos
  67, // Total costos y gastos deducibles = sum(62..66)
  // Renta
  70, // Renta por recuperación de deducciones · viene del Anexo 17
  72, // Renta líquida ordinaria = max(0, 61 + 69 + 70 + 71 - 52..56 - 67 - 68)
  73, // Pérdida líquida ordinaria (espejo de 72)
  74, // Compensaciones · viene del Anexo 20
  75, // Renta líquida = max(0, 72 - 74)
  76, // Renta presuntiva · viene del Anexo 1
  77, // Rentas exentas · viene del Anexo 19
  79, // Renta líquida gravable = max(75, 76) - 77 + 78
  // Ganancias ocasionales
  80, // Ingresos por GO · viene del Anexo 8
  81, // Costos por GO · viene del Anexo 8
  82, // GO no gravadas y exentas · viene del Anexo 8
  83, // Ganancias ocasionales gravables = max(0, 80 - 81 - 82)
  // Liquidación privada
  84, // Impuesto sobre la renta líquida gravable = 79 × tarifa del régimen
  85, // Sobretasa instituciones financieras (Par. 1° Art. 240 E.T.)
  91, // Total impuesto sobre rentas líquidas gravables = sum(84..90)
  93, // Descuentos tributarios · viene del Anexo 4
  97, // Impuesto neto de ganancias ocasionales = 83 × 15%
  105, // Autorretenciones · viene del Anexo 3
  106, // Otras retenciones · viene del Anexo 3
  108, // Anticipo año siguiente (Anexo 2 del .xlsm)
  112, // Sanciones (extemporaneidad + corrección, Arts. 641/642/644 E.T.)
  94, // Impuesto neto de renta (sin adicionado) = 91 + 92 - 93
  96, // Impuesto neto de renta (con adicionado) = 94 + 95
  99, // Total impuesto a cargo = 96 + 97 - 98
  107, // Total retenciones = 105 + 106
  111, // Saldo a pagar por impuesto = 99 + 108 + 110 - 100..104 - 107 - 109
  113, // Total saldo a pagar = 99 + 108 + 110 + 112 - 100..104 - 107 - 109
  114, // Total saldo a favor = 100..104 + 107 + 109 - 99 - 108 - 110 - 112
]);

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
  /** Estado de presentación calculado en engine/vencimientos.ts */
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
  /** ¿Aplica Tasa Mínima de Tributación Depurada (Art. 240 par. 6° E.T.)? */
  aplicaTasaMinima?: boolean;
  /** Datos de nómina (vienen de /configuracion tab Otros) */
  totalNomina?: number;
  aportesSegSocial?: number;
  aportesParaFiscales?: number;
  /** Anexo 3 · totales de retenciones y autorretenciones */
  totalAutorretenciones?: number;
  totalRetenciones?: number;
  /** Anexo 4 · total de descuentos tributarios */
  totalDescuentosTributarios?: number;
  /** Anexo 8 · totales de ganancia ocasional */
  goIngresos?: number;
  goCostos?: number;
  goNoGravada?: number;
  /** Anexo 19 · total rentas exentas → R77 */
  totalRentasExentas?: number;
  /** Anexo 20 · total compensaciones → R74 */
  totalCompensaciones?: number;
  /** Anexo 17 · total recuperación de deducciones → R70 */
  totalRecuperaciones?: number;
  /** Anexo 1 · renta presuntiva calculada → R76 */
  rentaPresuntiva?: number;
  /** Anexo 18 · dividendos por categoría (R49..R56) */
  dividendos?: {
    r49?: number;
    r50?: number;
    r51?: number;
    r52?: number;
    r53?: number;
    r54?: number;
    r55?: number;
    r56?: number;
  };
  /** Anexo 26 · INCRNGO total → R60 */
  totalIncrngo?: number;
};

const TARIFA_ANTICIPO: Record<NonNullable<ComputeContext["aniosDeclarando"]>, number> = {
  primero: 0.25,
  segundo: 0.5,
  tercero_o_mas: 0.75,
};

// Umbral en UVT para aplicar sobretasa de instituciones financieras
// (Par. 1° Art. 240 E.T., 5 puntos adicionales sobre el exceso)
const UMBRAL_SOBRETASA_UVT = 120000;
const PUNTOS_SOBRETASA = 0.05;

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

  // --- INCRNGO (Anexo 26) → R60 ---
  if (typeof ctx.totalIncrngo === "number") {
    v.set(60, ctx.totalIncrngo);
  }

  // --- Ingresos por dividendos (Anexo 18) ---
  if (ctx.dividendos) {
    if (typeof ctx.dividendos.r49 === "number") v.set(49, ctx.dividendos.r49);
    if (typeof ctx.dividendos.r50 === "number") v.set(50, ctx.dividendos.r50);
    if (typeof ctx.dividendos.r51 === "number") v.set(51, ctx.dividendos.r51);
    if (typeof ctx.dividendos.r52 === "number") v.set(52, ctx.dividendos.r52);
    if (typeof ctx.dividendos.r53 === "number") v.set(53, ctx.dividendos.r53);
    if (typeof ctx.dividendos.r54 === "number") v.set(54, ctx.dividendos.r54);
    if (typeof ctx.dividendos.r55 === "number") v.set(55, ctx.dividendos.r55);
    if (typeof ctx.dividendos.r56 === "number") v.set(56, ctx.dividendos.r56);
  }

  // --- Patrimonio ---
  const r44 = sumRango(v, 36, 43);
  v.set(44, r44);
  v.set(46, Math.max(0, r44 - get(45)));

  // --- Ingresos ---
  const r58 = sumRango(v, 47, 57);
  v.set(58, r58);
  v.set(61, Math.max(0, r58 - get(59) - get(60)));

  // --- Costos ---
  v.set(67, sumRango(v, 62, 66));

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
  // 70 = Renta por recuperación de deducciones (Anexo 17)
  if (typeof ctx.totalRecuperaciones === "number") {
    v.set(70, ctx.totalRecuperaciones);
  }
  // 76 = Renta presuntiva (Anexo 1)
  if (typeof ctx.rentaPresuntiva === "number") {
    v.set(76, ctx.rentaPresuntiva);
  }
  // 74 = Compensaciones (Anexo 20). Limitada al monto de la renta líquida (R72)
  if (typeof ctx.totalCompensaciones === "number") {
    v.set(74, Math.min(ctx.totalCompensaciones, get(72)));
  }
  // 77 = Rentas exentas (Anexo 19)
  if (typeof ctx.totalRentasExentas === "number") {
    v.set(77, ctx.totalRentasExentas);
  }
  // 75 = max(0, 72 - 74)
  v.set(75, Math.max(0, get(72) - get(74)));
  // 79 = max(75, 76) - 77 + 78  (Renta líquida gravable)
  //   "al mayor valor entre 75 y 76 reste 77 y sume 78"
  v.set(79, Math.max(get(75), get(76)) - get(77) + get(78));

  // --- Ganancias ocasionales (vienen del Anexo 8) ---
  if (typeof ctx.goIngresos === "number") v.set(80, ctx.goIngresos);
  if (typeof ctx.goCostos === "number") v.set(81, ctx.goCostos);
  if (typeof ctx.goNoGravada === "number") v.set(82, ctx.goNoGravada);
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
  //   5 puntos porcentuales sobre la renta líquida gravable COMPLETA cuando
  //   ésta supera 120.000 UVT. Replica la fórmula del Liquidador oficial:
  //   IF(D24="SI"; IF(R79 >= 120000*UVT; R79*5%; 0); 0)
  if (
    ctx.esInstitucionFinanciera &&
    typeof ctx.uvtVigente === "number" &&
    ctx.uvtVigente > 0
  ) {
    const rentaGravable = Math.max(0, get(79));
    const umbral = UMBRAL_SOBRETASA_UVT * ctx.uvtVigente;
    if (rentaGravable >= umbral) {
      v.set(85, Math.round(rentaGravable * PUNTOS_SOBRETASA));
    } else {
      v.set(85, 0);
    }
  } else {
    v.set(85, 0);
  }
  // 97 = Ganancias ocasionales gravables × 15% (tarifa fija AG 2025)
  v.set(97, Math.round(Math.max(0, get(83)) * TARIFA_GANANCIAS_OCASIONALES));
  // 91 = sum(84..90)  (Total impuesto sobre rentas líquidas gravables)
  v.set(91, sumRango(v, 84, 90));
  // 93 = Descuentos tributarios (suma del Anexo 4) sujeto a tope Art. 259 E.T.
  //   Tope: 75% del impuesto básico de renta (renglón 84). Se calcula ANTES
  //   de R94 para que el tope aplique a la fórmula 91 + 92 - 93.
  if (typeof ctx.totalDescuentosTributarios === "number") {
    const tope = Math.max(0, get(84)) * 0.75;
    v.set(93, Math.min(ctx.totalDescuentosTributarios, tope));
  }
  // 94 = max(0, 91 + 92 - 93)  (Impuesto neto de renta sin impuesto adicionado)
  //   El Liquidador oficial fuerza ≥0: si los descuentos exceden el impuesto
  //   bruto, el neto queda en 0 (no puede ser negativo).
  v.set(94, Math.max(0, get(91) + get(92) - get(93)));
  // 95 = Impuesto a Adicionar (IA) · Tasa Mínima de Tributación (TTD)
  //   Si el impuesto neto efectivo (R94/R79) está por debajo del 15%
  //   mínimo legal (Art. 240 par. 6° E.T.), se adiciona la diferencia.
  //   Si el usuario desactiva aplicaTasaMinima (zonas francas, etc.),
  //   se respeta el valor manual ingresado en R95.
  if (ctx.aplicaTasaMinima !== false) {
    const ia = calcularImpuestoAdicionar({
      rentaLiquidaGravable: get(79),
      impuestoNeto: get(94),
      aplica: true,
    });
    if (ia > 0) v.set(95, ia);
  }
  // 96 = 94 + 95  (Impuesto neto de renta con impuesto adicionado)
  v.set(96, get(94) + get(95));
  // 99 = max(0, 96 + 97 - 98)  (Total impuesto a cargo)
  //   También forzado ≥0 en el Liquidador oficial.
  v.set(99, Math.max(0, get(96) + get(97) - get(98)));

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

  // 112 = Sanción total = extemporaneidad + corrección (Arts. 641/642/644 E.T.)
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
  v.set(112, sancionExt + sancionCorr);

  // 108 = Anticipo año siguiente (Art. 807 E.T.)
  //   El Liquidador oficial implementa los DOS métodos del Anexo 2 y toma
  //   el MENOR (más favorable al contribuyente):
  //     Método 1 (F18) = ((impuesto_neto_actual + impuesto_neto_ant) / 2) × tarifa − R107
  //     Método 2 (G18) = impuesto_neto_actual × tarifa − R107
  //   Primer año: 0 (no aplica). En años posteriores: max(0, MIN(metodo1, metodo2)).
  if (
    typeof ctx.impuestoNetoAnterior === "number" &&
    typeof ctx.aniosDeclarando === "string"
  ) {
    if (ctx.aniosDeclarando === "primero") {
      v.set(108, 0);
    } else {
      const tarifa = TARIFA_ANTICIPO[ctx.aniosDeclarando];
      const retenciones = get(107);
      const promedio = (get(96) + ctx.impuestoNetoAnterior) / 2;
      const metodo1 = Math.max(0, promedio * tarifa - retenciones);
      const metodo2 = Math.max(0, get(96) * tarifa - retenciones);
      v.set(108, Math.round(Math.min(metodo1, metodo2)));
    }
  } else if (!v.has(108)) {
    v.set(108, 0);
  }

  // 111 = Saldo a pagar por impuesto
  //   = 99 + 108 + 110 - 100 - 101 - 102 - 103 - 104 - 107 - 109
  const restas = get(100) + get(101) + get(102) + get(103) + get(104) + get(107) + get(109);
  const r111 = get(99) + get(108) + get(110) - restas;
  v.set(111, Math.max(0, r111));

  // 113 = Total saldo a pagar
  //   = 99 + 108 + 110 + 112 - (mismo conjunto de restas)
  const r113 = get(99) + get(108) + get(110) + get(112) - restas;
  v.set(113, Math.max(0, r113));

  // 114 = Total saldo a favor (espejo de 113: si las restas exceden, hay saldo a favor)
  v.set(114, Math.max(0, restas - (get(99) + get(108) + get(110) + get(112))));

  // Redondeo DIAN: el Liquidador oficial aplica ROUND(x, -3) a todos los
  // renglones a nivel de Hoja Sumaria (cada renglón individual está
  // redondeado a múltiplos de 1.000 antes de sumar). Replicamos eso aquí:
  // todos los valores monetarios de la salida son múltiplos de 1.000.
  //
  // Los datos del usuario en DB mantienen su precisión original — el
  // redondeo es sólo para la SALIDA computada que se presenta/exporta.
  for (const [n, val] of v) {
    v.set(n, redondearDIAN(val));
  }

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
  49: "Anexo 18 · No constitutivos",
  50: "Anexo 18 · Distribuidos no residentes",
  51: "Anexo 18 · Tarifa general",
  52: "Anexo 18 · Persona natural residente",
  53: "Anexo 18 · No residentes (PN)",
  54: "Anexo 18 · Art. 245",
  55: "Anexo 18 · Ley 1819",
  56: "Anexo 18 · Proyectos calificados",
  60: "Suma del Anexo 26 (INCRNGO)",
  70: "Suma del Anexo 17 (recuperaciones)",
  73: "Espejo de 72 (si la base es negativa)",
  74: "Anexo 20 (limitado a la renta líquida 72)",
  75: "72 − 74 (si positivo)",
  76: "Anexo 1 · Renta Presuntiva",
  77: "Suma del Anexo 19",
  79: "max(75, 76) − 77 + 78",
  80: "Suma precios de venta del Anexo 8",
  81: "Suma costos fiscales del Anexo 8",
  82: "Suma no gravadas/exentas del Anexo 8",
  83: "80 − 81 − 82 (si positivo)",
  84: "79 × tarifa del régimen",
  85: "5% sobre exceso de 79 sobre 120.000 UVT (instituciones financieras)",
  91: "Suma de 84 a 90",
  93: "Anexo 4 (limitado al 75% del impto. básico, Art. 259 E.T.)",
  97: "83 × 15% (tarifa GO)",
  94: "91 + 92 − 93",
  96: "94 + 95",
  99: "96 + 97 − 98",
  105: "Suma de autorretenciones (Anexo 3)",
  106: "Suma de retenciones (Anexo 3)",
  107: "105 + 106",
  108: "(96 + impto. AG anterior) / 2 × tarifa años − 107",
  112: "Sanciones (extemporaneidad + corrección, Arts. 641/642/644 E.T.)",
  111: "99 + 108 + 110 − 100 − 101 − 102 − 103 − 104 − 107 − 109",
  113: "99 + 108 + 110 + 112 − (restas de 111)",
  114: "Diferencia (saldo a favor) si las restas exceden",
};
