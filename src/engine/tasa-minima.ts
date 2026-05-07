// Tasa Mínima de Tributación Depurada (TTD) · Art. 240 par. 6° E.T.
//
// Ley 2277 de 2022 introdujo la TTD: las personas jurídicas (régimen
// ordinario) deben pagar un impuesto efectivo mínimo del 15% sobre la
// renta líquida gravable. Si la tasa efectiva calculada queda por debajo
// del 15%, el contribuyente debe ADICIONAR al impuesto la diferencia
// para alcanzar el 15%. Esa adición se reporta en el R95 (IA · Impuesto
// a Adicionar) del Formulario 110, lo que aumenta R96 (impuesto neto
// con adicionado).
//
// Excepciones (NO aplica):
//   - Personas jurídicas extranjeras sin residencia
//   - Empresas en zonas francas (regímenes 03, 04, 05, etc.)
//   - Empresas con renta líquida gravable ≤ 0 (no hay base)
//   - Algunos sectores específicos (verificar régimen tributario)
//
// El usuario puede desactivar el cálculo manualmente vía la columna
// `aplica_tasa_minima` cuando aplique alguna excepción.

/** Tasa mínima de tributación depurada. Ley 2277/2022. */
export const TASA_MINIMA = 0.15;

/**
 * Calcula el Impuesto a Adicionar (IA) cuando la tasa efectiva sobre la
 * renta líquida gravable queda por debajo del 15% mínimo.
 *
 *   TTD = impuestoNeto / rentaLiquidaGravable
 *   IA  = max(0, rentaLiquidaGravable × 15% − impuestoNeto)
 *
 * Versión simplificada · usa R79 (renta líquida gravable) como base de
 * cálculo de la tasa efectiva en lugar de la "Utilidad Depurada" formal
 * del DIAN. Es una aproximación conservadora que captura el espíritu del
 * artículo y funciona para la mayoría de empresas pequeñas y medianas.
 *
 * Para empresas con muchas diferencias permanentes y temporales, el
 * cálculo "verdadero" usa la fórmula DIAN específica con UD (utilidad
 * depurada) que aún no implementamos. En ese caso el usuario puede
 * sobreescribir manualmente el R95 ingresándolo como input directo.
 */
export function calcularImpuestoAdicionar(args: {
  rentaLiquidaGravable: number;
  impuestoNeto: number;
  aplica: boolean;
}): number {
  const { rentaLiquidaGravable, impuestoNeto, aplica } = args;
  if (!aplica) return 0;
  if (rentaLiquidaGravable <= 0) return 0;
  const ia = rentaLiquidaGravable * TASA_MINIMA - impuestoNeto;
  return Math.max(0, ia);
}

/**
 * Tasa efectiva actual del impuesto sobre la renta líquida gravable.
 * Devuelve null si no hay base (renta gravable ≤ 0).
 */
export function calcularTasaEfectiva(
  rentaLiquidaGravable: number,
  impuestoNeto: number,
): number | null {
  if (rentaLiquidaGravable <= 0) return null;
  return impuestoNeto / rentaLiquidaGravable;
}
