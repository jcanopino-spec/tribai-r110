// Utilidades del motor: helpers numéricos, normalización de signos y
// redondeos al estándar DIAN.

/**
 * Renglones del Formulario 110 que deben mostrarse siempre en valor
 * positivo, aunque la cuenta contable subyacente tenga saldo crédito.
 *
 * - Pasivos (45): cuentas clase 2 vienen negativas en el TB.
 * - Ingresos individuales (47..57): cuentas clase 4 vienen negativas.
 * - Devoluciones, INCRNGO (59, 60): naturales reductores de ingresos.
 * - Costos individuales (62..66): suelen ser positivos pero forzamos por
 *   consistencia con el formato del 110.
 */
export const RENGLONES_POSITIVOS = new Set<number>([
  45,
  47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
  59, 60,
  62, 63, 64, 65, 66,
]);

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

/**
 * Suma valores de un rango cerrado de renglones [from, to].
 */
export function sumRango(
  values: Map<number, number>,
  from: number,
  to: number,
): number {
  let s = 0;
  for (let n = from; n <= to; n++) s += values.get(n) ?? 0;
  return s;
}

/**
 * Redondeo DIAN: equivalente a ROUND(n, -3) en Excel — redondea al múltiplo
 * de 1.000 más cercano. Aplicado por el Liquidador oficial DIAN AG 2025 a
 * casi todos los renglones derivados (Hoja Sumaria) para que los valores
 * presentados al MUISCA sean siempre múltiplos de mil.
 */
export function redondearDIAN(n: number): number {
  return Math.round(n / 1000) * 1000;
}
