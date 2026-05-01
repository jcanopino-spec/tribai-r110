// Formulas de los renglones computados del Formulario 110 AG 2025.
// Extraidas del .xlsm fuente (hojas '110 MUISCA' y 'Formulario 110').
// Cuando se cambien renglones de input, los computados se recalculan en
// vivo en la UI. No se mapean cuentas contables a estos renglones.

export const RENGLONES_COMPUTADOS = new Set<number>([
  44, // Total patrimonio bruto = sum(36..43)
  46, // Total patrimonio líquido = max(0, 44 - 45)
  58, // Total ingresos brutos = sum(47..57)
  61, // Total ingresos netos = max(0, 58 - 59 - 60)
  67, // Total costos y gastos deducibles = sum(62..66)
]);

const sum = (values: Map<number, number>, from: number, to: number) => {
  let s = 0;
  for (let n = from; n <= to; n++) s += values.get(n) ?? 0;
  return s;
};

/**
 * Calcula los valores derivados a partir de los inputs.
 * No muta el mapa original. Devuelve un nuevo mapa con los computados aplicados.
 */
export function computarRenglones(valores: Map<number, number>): Map<number, number> {
  const v = new Map(valores);

  const r44 = sum(v, 36, 43);
  v.set(44, r44);

  const r45 = v.get(45) ?? 0;
  v.set(46, Math.max(0, r44 - r45));

  const r58 = sum(v, 47, 57);
  v.set(58, r58);

  const r59 = v.get(59) ?? 0;
  const r60 = v.get(60) ?? 0;
  v.set(61, Math.max(0, r58 - r59 - r60));

  v.set(67, sum(v, 62, 66));

  return v;
}

/**
 * Pequeña descripción de cada fórmula para mostrar como tooltip o subtítulo.
 */
export const FORMULAS_LEYENDA: Record<number, string> = {
  44: "Suma de 36 a 43",
  46: "44 − 45 (si positivo, si no 0)",
  58: "Suma de 47 a 57",
  61: "58 − 59 − 60 (si positivo, si no 0)",
  67: "Suma de 62 a 66",
};
