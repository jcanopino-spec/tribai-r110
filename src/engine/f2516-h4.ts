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

export const F2516_H4_CATEGORIAS: F2516H4Categoria[] = [
  // Activos por impuesto diferido (diferencias deducibles)
  {
    id: "A1",
    tipo: "atd",
    concepto: "PP&E (depreciación contable > fiscal)",
    ayuda:
      "La depreciación NIIF acumulada es mayor que la fiscal · genera diferencia deducible que se realizará en periodos futuros.",
  },
  {
    id: "A2",
    tipo: "atd",
    concepto: "Intangibles (amortización mayor)",
    ayuda:
      "Amortización contable mayor que la fiscal o vida útil distinta · revisar Art. 143-1 E.T.",
  },
  {
    id: "A3",
    tipo: "atd",
    concepto: "Inventarios (deterioro fiscal limitado)",
    ayuda: "Deterioro contable de inventarios no aceptado fiscalmente.",
  },
  {
    id: "A4",
    tipo: "atd",
    concepto: "Cartera (provisión deterioro Art. 145)",
    ayuda:
      "Provisión contable de deterioro de cartera no totalmente deducible · Art. 145 E.T.",
  },
  {
    id: "A5",
    tipo: "atd",
    concepto: "Inversiones (medición a valor razonable)",
    ayuda: "Pérdidas no realizadas reconocidas contablemente.",
  },
  {
    id: "A6",
    tipo: "atd",
    concepto: "Beneficios empleados (provisiones)",
    ayuda:
      "Provisiones por bonos, prestaciones, etc. no causadas fiscalmente.",
  },
  {
    id: "A7",
    tipo: "atd",
    concepto: "Pérdidas fiscales acumuladas",
    ayuda: "Pérdidas fiscales pendientes de compensar · Art. 147 E.T.",
  },
  {
    id: "A8",
    tipo: "atd",
    concepto: "Excesos de renta presuntiva",
    ayuda:
      "Excesos de renta presuntiva sobre líquida pendientes de compensar · Art. 189 par.",
  },
  // Pasivos por impuesto diferido (diferencias imponibles)
  {
    id: "P1",
    tipo: "ptd",
    concepto: "PP&E (depreciación fiscal > contable)",
    ayuda: "Depreciación fiscal acelerada mayor que la contable.",
  },
  {
    id: "P2",
    tipo: "ptd",
    concepto: "Activos biológicos (medición razonable)",
    ayuda: "Ganancias no realizadas reconocidas contablemente (NIC 41).",
  },
  {
    id: "P3",
    tipo: "ptd",
    concepto: "Inversiones (revalúo fiscal mayor)",
    ayuda: "Ganancias no realizadas en inversiones medidas a valor razonable.",
  },
  {
    id: "P4",
    tipo: "ptd",
    concepto: "Diferencias en cambio (causación distinta)",
    ayuda:
      "Diferencia en cambio realizada fiscalmente pero no contablemente o viceversa · Art. 285 E.T.",
  },
  {
    id: "P5",
    tipo: "ptd",
    concepto: "Subvenciones gubernamentales",
    ayuda: "Subvenciones diferidas contablemente pero ya reconocidas fiscalmente.",
  },
  {
    id: "P6",
    tipo: "ptd",
    concepto: "Otros pasivos diferidos",
    ayuda: "Otras diferencias temporarias imponibles.",
  },
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
