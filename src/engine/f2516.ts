// Formato 2516 v.9 · Conciliación fiscal ESF + ERI
// (Reporte oficial DIAN para PJ del régimen ordinario, Resolución 71/2019.)
//
// La hoja "Formato 2516" del .xlsm guía v5 es una versión COMPACTA de 18
// filas que conecta el balance contable con los renglones del 110:
//
//   ESF · Activos       (8 categorías + total)
//   ESF · Pasivos       (1 fila)
//   Patrimonio          (1 fila)
//   ERI · Ingresos      (4 filas)
//   ERI · Costos        (1 fila)
//   Resultado           (2 filas: renta líquida + GO)
//
// Cada fila tiene 5 columnas:
//   CONTABLE      — saldo del balance (clases 1..7 según fila)
//   CONVERSIÓN    — ajuste por convergencia NIIF (manual)
//   MENOR FISCAL  — ajuste reduce el valor fiscal (manual)
//   MAYOR FISCAL  — ajuste aumenta el valor fiscal (manual)
//   FISCAL        — Contable + Conversión − Menor + Mayor
//
// El total fiscal de cada fila debe cuadrar contra el renglón equivalente
// del Formulario 110 (ej. ESF Activos total fiscal = R44 patrimonio bruto).
// Esa validación cruzada vive en `loadF2516Aggregates`.

export type F2516FilaId =
  // ESF · Activos
  | "ESF_01_EFECTIVO"
  | "ESF_02_INVERSIONES"
  | "ESF_03_CXC"
  | "ESF_04_INVENT"
  | "ESF_05_INTAN"
  | "ESF_06_BIO"
  | "ESF_07_PPE"
  | "ESF_08_OTROS"
  | "ESF_09_TOTAL_ACT"
  // ESF · Pasivos
  | "ESF_10_PASIVOS"
  // Patrimonio
  | "PAT_11_LIQUIDO"
  // ERI · Ingresos
  | "ERI_12_INGRESOS"
  | "ERI_13_DEVOL"
  | "ERI_14_INCRNGO"
  | "ERI_15_NETOS"
  // ERI · Costos
  | "ERI_16_COSTOS"
  // Resultado
  | "RES_17_RENTA_LIQ"
  | "RES_18_GO";

export type F2516Seccion =
  | "ESF · Activos"
  | "ESF · Pasivos"
  | "Patrimonio"
  | "ERI · Ingresos"
  | "ERI · Costos"
  | "Resultado";

export type F2516Fila = {
  id: F2516FilaId;
  numero: number;
  label: string;
  seccion: F2516Seccion;
  /** ¿Es total/subtotal computado? Si lo es, no se cargan ajustes manuales. */
  esTotal?: boolean;
  /** Renglón del F110 contra el que cuadra el FISCAL de esta fila. */
  cuadraConR110?: number;
  /** Tooltip explicativo. */
  ayuda?: string;
};

export const F2516_FILAS: readonly F2516Fila[] = [
  // ESF · Activos
  { id: "ESF_01_EFECTIVO", numero: 1, label: "Efectivo y equivalentes", seccion: "ESF · Activos" },
  { id: "ESF_02_INVERSIONES", numero: 2, label: "Inversiones", seccion: "ESF · Activos" },
  { id: "ESF_03_CXC", numero: 3, label: "Cuentas por cobrar", seccion: "ESF · Activos" },
  { id: "ESF_04_INVENT", numero: 4, label: "Inventarios", seccion: "ESF · Activos" },
  { id: "ESF_05_INTAN", numero: 5, label: "Intangibles", seccion: "ESF · Activos" },
  { id: "ESF_06_BIO", numero: 6, label: "Biológicos", seccion: "ESF · Activos" },
  { id: "ESF_07_PPE", numero: 7, label: "Propiedad, planta y equipo", seccion: "ESF · Activos" },
  { id: "ESF_08_OTROS", numero: 8, label: "Otros activos", seccion: "ESF · Activos" },
  {
    id: "ESF_09_TOTAL_ACT",
    numero: 9,
    label: "TOTAL ACTIVOS",
    seccion: "ESF · Activos",
    esTotal: true,
    cuadraConR110: 44,
    ayuda: "Suma de filas 1 a 8. Debe cuadrar con el patrimonio bruto del 110 (R44).",
  },
  // ESF · Pasivos
  {
    id: "ESF_10_PASIVOS",
    numero: 10,
    label: "Total pasivos",
    seccion: "ESF · Pasivos",
    cuadraConR110: 45,
  },
  // Patrimonio
  {
    id: "PAT_11_LIQUIDO",
    numero: 11,
    label: "Patrimonio líquido",
    seccion: "Patrimonio",
    cuadraConR110: 46,
    ayuda: "TOTAL ACTIVOS − Total pasivos. Cuadra con R46 patrimonio líquido.",
  },
  // ERI · Ingresos
  {
    id: "ERI_12_INGRESOS",
    numero: 12,
    label: "Total ingresos brutos",
    seccion: "ERI · Ingresos",
    cuadraConR110: 58,
  },
  { id: "ERI_13_DEVOL", numero: 13, label: "Devoluciones", seccion: "ERI · Ingresos", cuadraConR110: 59 },
  { id: "ERI_14_INCRNGO", numero: 14, label: "INCRNGO", seccion: "ERI · Ingresos", cuadraConR110: 60 },
  {
    id: "ERI_15_NETOS",
    numero: 15,
    label: "Ingresos netos",
    seccion: "ERI · Ingresos",
    esTotal: true,
    cuadraConR110: 61,
    ayuda: "Ingresos brutos − Devoluciones − INCRNGO. Cuadra con R61.",
  },
  // ERI · Costos
  {
    id: "ERI_16_COSTOS",
    numero: 16,
    label: "Total costos y deducciones",
    seccion: "ERI · Costos",
    cuadraConR110: 67,
  },
  // Resultado
  {
    id: "RES_17_RENTA_LIQ",
    numero: 17,
    label: "Renta líquida gravable",
    seccion: "Resultado",
    esTotal: true,
    cuadraConR110: 79,
    ayuda: "Ingresos netos − Costos. Cuadra con R79 (renta líquida gravable).",
  },
  {
    id: "RES_18_GO",
    numero: 18,
    label: "Ganancias ocasionales gravables",
    seccion: "Resultado",
    esTotal: true,
    cuadraConR110: 83,
    ayuda: "GO ingresos − GO costos − GO no gravadas. Cuadra con R83.",
  },
];

/**
 * Mapeo prefijo PUC → fila del F2516.
 *
 * Estandariza el catálogo PUC colombiano (Decreto 2650/93). Cada prefijo
 * de 4 dígitos cae en una de las 11 filas de balance (ESF/Pasivos/
 * Patrimonio); las cuentas P&L (4..7) caen en filas ERI.
 *
 * Si la cuenta tiene 6+ dígitos se trunca a 4 para clasificar.
 * Para detección de biológicos vs PPE (ambos clase 15), se usa el código
 * 1505/1510... según el catálogo del Detalle Fiscal del .xlsm.
 *
 * Devuelve null si la cuenta no es clasificable (típicamente cuentas de
 * orden — clase 8 y 9 — que no entran al F2516).
 */
export function categorizarPucF2516(puc: string | null | undefined): F2516FilaId | null {
  if (!puc) return null;
  const p = String(puc).replace(/[^0-9]/g, "").padEnd(4, "0").slice(0, 4);
  if (p.length < 4) return null;

  // Activos · clase 1
  if (p.startsWith("11")) return "ESF_01_EFECTIVO"; // 1105 caja, 1110 bancos, 1115...
  if (p.startsWith("12")) return "ESF_02_INVERSIONES";
  if (p.startsWith("13")) return "ESF_03_CXC";
  if (p.startsWith("14")) return "ESF_04_INVENT";
  // Clase 15: biológicos (15-15-19 históricamente) vs PPE
  // En PUC oficial 1504..1599 = PPE incluido biológicos. El liquidador
  // agrupa biológicos aparte: 1567..1569 (semovientes). Resto = PPE.
  if (p === "1567" || p === "1568" || p === "1569") return "ESF_06_BIO";
  if (p.startsWith("15")) return "ESF_07_PPE";
  if (p.startsWith("16")) return "ESF_05_INTAN"; // intangibles
  if (p.startsWith("17") || p.startsWith("18") || p.startsWith("19"))
    return "ESF_08_OTROS";

  // Pasivos · clase 2
  if (p.startsWith("2")) return "ESF_10_PASIVOS";

  // Patrimonio · clase 3 → no entra como activo/pasivo, va a la fila de
  // patrimonio líquido pero ese se calcula como ACTIVOS − PASIVOS. Por eso
  // las cuentas clase 3 no se mapean a una fila del F2516 directamente:
  // su saldo aparece como diferencia y se concilia aparte.
  if (p.startsWith("3")) return null;

  // ERI · Ingresos · clase 4
  // 4xxx ingresos brutos. Devoluciones tienen códigos específicos: 4175
  // (devoluciones rebajas y descuentos en ventas), 4275 idem no operacionales.
  if (p === "4175" || p === "4275") return "ERI_13_DEVOL";
  if (p.startsWith("4")) return "ERI_12_INGRESOS";

  // ERI · Costos · clases 5, 6, 7
  if (p.startsWith("5") || p.startsWith("6") || p.startsWith("7"))
    return "ERI_16_COSTOS";

  // Cuentas de orden (8, 9) no entran
  return null;
}

export type F2516CalculoFila = {
  fila: F2516Fila;
  contable: number;
  conversion: number;
  menorFiscal: number;
  mayorFiscal: number;
  fiscal: number;
};

/**
 * Aplica la fórmula del .xlsm:
 *   Fiscal = Contable + Conversión − MenorFiscal + MayorFiscal
 */
export function calcularFiscal(args: {
  contable: number;
  conversion: number;
  menorFiscal: number;
  mayorFiscal: number;
}): number {
  return args.contable + args.conversion - args.menorFiscal + args.mayorFiscal;
}
