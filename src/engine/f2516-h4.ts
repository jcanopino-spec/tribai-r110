// F2516 · Hoja 4 · Impuesto Diferido (NIC 12)
//
// Captura las diferencias temporarias entre la base contable (NIIF) y la
// fiscal de cada categoría. Las diferencias deducibles generan ATD
// (activos por impuesto diferido); las imponibles generan PTD (pasivos).
//
//   ATD = max(0, base_contable − base_fiscal) × tarifa
//   PTD = max(0, base_fiscal − base_contable) × tarifa
//
// El total ATD alimenta el R165 del ESF; el total PTD alimenta el R240.
// La diferencia neta (ATD − PTD) afecta el resultado del ejercicio en H3.

export type F2516H4Tipo = "atd" | "ptd";

export type F2516H4Categoria = {
  id: string;
  tipo: F2516H4Tipo;
  concepto: string;
  ayuda: string;
};

/**
 * Catálogo oficial DIAN H4 del Formato 2516 (modelo110.xlsm).
 *
 * Estructura exacta: 18 categorías por lado (ATD y PTD), cada una con su
 * espejo. Cubre todo el balance NIIF que puede generar diferencias
 * temporarias respecto al fiscal.
 *
 * Las 18 categorías son las mismas tanto en activos diferidos (ATD ·
 * diferencias temporarias deducibles) como en pasivos diferidos (PTD ·
 * diferencias temporarias imponibles), reflejando la simetría que la
 * DIAN espera para la conciliación NIC 12.
 */
const CATEGORIAS_BASE = [
  "Efectivo y equivalentes al efectivo",
  "Inversiones e instrumentos derivados",
  "Cuentas por cobrar",
  "Inventarios",
  "Propiedades, planta y equipo",
  "Activos intangibles",
  "Propiedades de inversión",
  "Activos biológicos",
  "Activos no corrientes mantenidos para la venta / entregar a propietarios",
  "Pasivos financieros y cuentas por pagar",
  "Impuestos, gravámenes y tasas",
  "Beneficios a Empleados",
  "Provisiones",
  "Otros Pasivos · Anticipos y avances recibidos",
  "Operaciones con títulos y derivados",
  "Pérdidas fiscales y/o excesos de renta presuntiva",
  "Activos reconocidos solamente para fines fiscales",
  "Otros activos",
] as const;

export const F2516_H4_CATEGORIAS: F2516H4Categoria[] = [
  // 18 Activos por impuesto diferido · diferencias temporarias deducibles
  ...CATEGORIAS_BASE.map((concepto, i) => ({
    id: `A${i + 1}`,
    tipo: "atd" as const,
    concepto,
    ayuda: `Diferencia temporaria deducible · ${concepto}. Genera Activo por Impuesto Diferido (ATD) cuando la base contable supera la fiscal · revierte en periodos futuros como deducción.`,
  })),
  // 18 Pasivos por impuesto diferido · diferencias temporarias imponibles
  ...CATEGORIAS_BASE.map((concepto, i) => ({
    id: `P${i + 1}`,
    tipo: "ptd" as const,
    concepto,
    ayuda: `Diferencia temporaria imponible · ${concepto}. Genera Pasivo por Impuesto Diferido (PTD) cuando la base fiscal supera la contable · revierte en periodos futuros como ingreso gravable.`,
  })),
];

export type F2516H4Captura = {
  declaracion_id: string;
  categoria_id: string;
  tipo: F2516H4Tipo;
  base_contable: number;
  base_fiscal: number;
  tarifa: number;
  observacion: string | null;
};

export type F2516H4FilaCalculada = {
  categoria: F2516H4Categoria;
  baseContable: number;
  baseFiscal: number;
  diferencia: number;
  tarifa: number;
  impuestoDiferido: number;
  observacion: string | null;
};

/**
 * Calcula el impuesto diferido para una categoría.
 * ATD: max(0, contable - fiscal) × tarifa
 * PTD: max(0, fiscal - contable) × tarifa
 */
export function calcularImpuestoDiferido(
  tipo: F2516H4Tipo,
  baseContable: number,
  baseFiscal: number,
  tarifa: number,
): { diferencia: number; impuestoDiferido: number } {
  const diferencia =
    tipo === "atd" ? baseContable - baseFiscal : baseFiscal - baseContable;
  const impuestoDiferido = Math.max(0, diferencia) * tarifa;
  return { diferencia, impuestoDiferido };
}

export type F2516H4Resumen = {
  filas: F2516H4FilaCalculada[];
  totalATD: number;
  totalPTD: number;
  impuestoDiferidoNeto: number;
};

export function computarH4(capturas: F2516H4Captura[]): F2516H4Resumen {
  const byId = new Map<string, F2516H4Captura>();
  for (const c of capturas) byId.set(c.categoria_id, c);

  const filas: F2516H4FilaCalculada[] = F2516_H4_CATEGORIAS.map((cat) => {
    const c = byId.get(cat.id);
    const baseContable = c?.base_contable ?? 0;
    const baseFiscal = c?.base_fiscal ?? 0;
    const tarifa = c?.tarifa ?? 0.35;
    const { diferencia, impuestoDiferido } = calcularImpuestoDiferido(
      cat.tipo,
      baseContable,
      baseFiscal,
      tarifa,
    );
    return {
      categoria: cat,
      baseContable,
      baseFiscal,
      diferencia,
      tarifa,
      impuestoDiferido,
      observacion: c?.observacion ?? null,
    };
  });

  const totalATD = filas
    .filter((f) => f.categoria.tipo === "atd")
    .reduce((s, f) => s + f.impuestoDiferido, 0);
  const totalPTD = filas
    .filter((f) => f.categoria.tipo === "ptd")
    .reduce((s, f) => s + f.impuestoDiferido, 0);

  return {
    filas,
    totalATD,
    totalPTD,
    impuestoDiferidoNeto: totalATD - totalPTD,
  };
}
