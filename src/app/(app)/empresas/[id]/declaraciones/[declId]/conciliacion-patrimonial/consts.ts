// Conciliación Patrimonial · Justifica la variación del patrimonio
// líquido fiscal entre AG anterior y AG actual.
export type State = { error: string | null; ok: boolean };
export type Signo = "mas" | "menos";

// Sugerencias de conceptos comunes para partidas manuales (datalist)
export const CONCEPTOS_AUMENTO = [
  "Aportes de capital · emisión de acciones",
  "Capitalización de utilidades retenidas",
  "Capitalización de revalorización del patrimonio",
  "Incorporación de bienes recibidos por sucesión / donación",
  "Valorización fiscal de activos (Art. 282 E.T.)",
  "Ajuste por reexpresión / actualización fiscal",
  "Préstamos de socios capitalizados",
  "Reservas constituidas por destinación de utilidades",
];

export const CONCEPTOS_DISMINUCION = [
  "Distribución de dividendos a socios / accionistas",
  "Reembolso de aportes / readquisición de acciones",
  "Compra de acciones propias",
  "Pago de impuesto al patrimonio (años aplicables)",
  "Ajuste por errores contables de períodos anteriores",
  "Pérdidas no compensables fiscalmente",
  "Castigos / bajas de cartera",
  "Reservas liberadas y transferidas a socios",
];
