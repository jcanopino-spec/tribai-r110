// Conciliación Fiscal · Utilidad contable → Renta líquida fiscal
export type State = { error: string | null; ok: boolean };
export type Tipo = "permanente" | "temporal";
export type Signo = "mas" | "menos";

// Sugerencias de conceptos comunes (datalist)
export const CONCEPTOS_PERMANENTES = [
  "Multas y sanciones",
  "50% ICA pagado (tomado como descuento)",
  "50% GMF pagado",
  "Intereses moratorios fiscales",
  "Gastos sin soporte de factura",
  "Donaciones no deducibles",
  "Gastos de períodos anteriores",
  "Costos en operaciones con vinculados sin precios de transferencia",
  "Pagos a paraísos fiscales no certificados",
  "Subcapitalización · intereses no deducibles",
  "Limitación gastos exterior (Art. 122 E.T.)",
  "50% impuestos no deducibles",
];

export const CONCEPTOS_TEMPORALES = [
  "Diferencia deterioro de cartera (fiscal − contable)",
  "Diferencia depreciación (fiscal − contable)",
  "Provisiones contables no aceptadas",
  "Pasivos estimados no realizados",
  "Beneficios a empleados no pagados al 31-dic",
  "Aportes seg. social pagados después del cierre",
  "Leasing financiero · diferencia activación",
  "Anticipos de clientes (ingreso fiscal)",
  "Diferencia en cambio no realizada",
  "Activos biológicos · medición a valor razonable",
  "Amortización crédito mercantil",
];
