/**
 * Año gravable activo y soportados.
 * Se mantiene una constante por año para que la UI permita configurar
 * tarifas, topes y reglas específicas del año.
 */

export type TaxYear = 2024 | 2025 | 2026;

export const SUPPORTED_YEARS: TaxYear[] = [2024, 2025, 2026];

export const DEFAULT_YEAR: TaxYear = Number(
  process.env.NEXT_PUBLIC_DEFAULT_YEAR ?? 2025,
) as TaxYear;
