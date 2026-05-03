// Conciliación Patrimonial · Justifica la variación del patrimonio
// líquido fiscal entre AG anterior y AG actual.
export type State = { error: string | null; ok: boolean };
export type Signo = "mas" | "menos";

// Sugerencias de conceptos para partidas manuales (datalist).
// Los conceptos clave que ajustan la fórmula Art. 236 son:
//   "Valorizaciones" (signo menos)        → resta a la diferencia patrimonial
//   "Desvalorizaciones" (signo más)       → suma a la diferencia patrimonial
//   "Normalización tributaria" (más)      → suma a las rentas ajustadas
// El nombre debe contener esas palabras clave para que el cálculo las
// detecte automáticamente.
export const CONCEPTOS_AUMENTO = [
  "Desvalorizaciones de activos (manual)",
  "Normalización tributaria del año (Ley 2277/2022)",
  "Aportes de capital · emisión de acciones",
  "Capitalización de utilidades retenidas",
  "Incorporación de bienes recibidos por sucesión / donación",
  "Préstamos de socios capitalizados",
  "Reservas constituidas por destinación de utilidades",
  "Ajuste por reexpresión / actualización fiscal",
];

export const CONCEPTOS_DISMINUCION = [
  "Valorizaciones de activos (Art. 282 E.T.)",
  "Distribución de dividendos a socios / accionistas",
  "Reembolso de aportes / readquisición de acciones",
  "Compra de acciones propias",
  "Pago de impuesto al patrimonio (años aplicables)",
  "Ajuste por errores contables de períodos anteriores",
  "Castigos / bajas de cartera",
  "Reservas liberadas y transferidas a socios",
];
