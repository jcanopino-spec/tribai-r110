// Impuesto Diferido · NIC 12 / Sección 29 NIIF Pymes.
//
// Surge de las diferencias TEMPORARIAS entre la base contable y la
// base fiscal de activos y pasivos (no las permanentes — esas no
// generan impuesto diferido).
//
// FÓRMULAS DEL .xlsm guía v5 (hoja "Impuesto Diferido"):
//
//   Para ACTIVOS:
//     Si BASE_CONTABLE < BASE_FISCAL → DIF. DEDUCIBLE  = FISCAL − CONTABLE
//     Si BASE_CONTABLE > BASE_FISCAL → DIF. IMPONIBLE  = CONTABLE − FISCAL
//
//   Para PASIVOS (signos invertidos):
//     Si BASE_CONTABLE > BASE_FISCAL → DIF. DEDUCIBLE  = CONTABLE − FISCAL
//     Si BASE_CONTABLE < BASE_FISCAL → DIF. IMPONIBLE  = FISCAL − CONTABLE
//
//   Activo por Impuesto Diferido (ID-A) = ROUND(deducible × tarifa, -3)
//   Pasivo por Impuesto Diferido (ID-P) = ROUND(imponible × tarifa, -3)
//
//   Gasto (Ingreso) Neto = Total ID-P − Total ID-A
//
// Las BASES vienen del balance: la CONTABLE = saldo del balance,
// la FISCAL = saldo + ajustes (= el "fiscal" del F2516).

import type { F2516FilaId } from "./f2516";

export type IDCategoriaTipo = "activo" | "pasivo";

export type IDCategoria = {
  id: string;
  numero: number;
  label: string;
  tipo: IDCategoriaTipo;
  /** Fila del F2516 que provee las bases contable y fiscal (si aplica). */
  f2516FilaId?: F2516FilaId;
};

/**
 * 9 categorías de ACTIVOS (mismas del F2516 ESF · Activos) +
 * 7 categorías de PASIVOS (subdivisión del F2516 fila 10 Pasivos).
 *
 * Las del F2516 se mapean directo. Los pasivos se desglosan según
 * el detalle del .xlsm (no todas mapean al F2516 que solo tiene
 * "Total pasivos" agregado; para pasivos el usuario debe capturar
 * manualmente las bases o vendrán de un agregado por subprefijo PUC).
 */
export const ID_CATEGORIAS: readonly IDCategoria[] = [
  // Activos · cada uno coincide con una fila del F2516
  { id: "ACT_01_EFECTIVO", numero: 1, label: "Efectivo y equivalentes", tipo: "activo", f2516FilaId: "ESF_01_EFECTIVO" },
  { id: "ACT_02_INVERSIONES", numero: 2, label: "Inversiones", tipo: "activo", f2516FilaId: "ESF_02_INVERSIONES" },
  { id: "ACT_03_CXC", numero: 3, label: "Cuentas por cobrar (netas)", tipo: "activo", f2516FilaId: "ESF_03_CXC" },
  { id: "ACT_04_INVENT", numero: 4, label: "Inventarios", tipo: "activo", f2516FilaId: "ESF_04_INVENT" },
  { id: "ACT_05_INTAN", numero: 5, label: "Activos intangibles", tipo: "activo", f2516FilaId: "ESF_05_INTAN" },
  { id: "ACT_06_PPE", numero: 6, label: "Propiedad, planta y equipo (neto)", tipo: "activo", f2516FilaId: "ESF_07_PPE" },
  { id: "ACT_07_PROPINV", numero: 7, label: "Propiedades de inversión", tipo: "activo" }, // sin mapping directo
  { id: "ACT_08_BIO", numero: 8, label: "Activos biológicos", tipo: "activo", f2516FilaId: "ESF_06_BIO" },
  { id: "ACT_09_OTROS", numero: 9, label: "Otros activos", tipo: "activo", f2516FilaId: "ESF_08_OTROS" },
  // Pasivos · subdivisiones (no en el F2516 compacto)
  { id: "PAS_01_OBLIGFIN", numero: 1, label: "Obligaciones financieras", tipo: "pasivo" },
  { id: "PAS_02_PROV", numero: 2, label: "Proveedores", tipo: "pasivo" },
  { id: "PAS_03_CXP", numero: 3, label: "Cuentas por pagar", tipo: "pasivo" },
  { id: "PAS_04_LABOR", numero: 4, label: "Obligaciones laborales", tipo: "pasivo" },
  { id: "PAS_05_PROV_EST", numero: 5, label: "Pasivos estimados y provisiones", tipo: "pasivo" },
  { id: "PAS_06_IMPTOS", numero: 6, label: "Impuestos por pagar", tipo: "pasivo" },
  { id: "PAS_07_OTROS", numero: 7, label: "Otros pasivos", tipo: "pasivo" },
];

/** Tarifa estándar del régimen general (35%). El usuario puede ajustarla. */
export const TARIFA_ID_DEFAULT = 0.35;

/** Redondeo DIAN al múltiplo de 1.000 más cercano. */
function redondear(n: number): number {
  return Math.round(n / 1000) * 1000;
}

export type IDFilaCalculada = {
  categoria: IDCategoria;
  baseContable: number;
  baseFiscal: number;
  difDeducible: number;
  difImponible: number;
  idActivo: number;
  idPasivo: number;
};

/**
 * Calcula la fila del impuesto diferido para una categoría a partir de
 * la base contable y la base fiscal.
 */
export function calcularFilaID(args: {
  categoria: IDCategoria;
  baseContable: number;
  baseFiscal: number;
  tarifa: number;
}): IDFilaCalculada {
  const { categoria, baseContable, baseFiscal, tarifa } = args;
  const c = baseContable;
  const f = baseFiscal;

  let difDeducible = 0;
  let difImponible = 0;

  if (categoria.tipo === "activo") {
    if (c < f) difDeducible = f - c;
    if (c > f) difImponible = c - f;
  } else {
    // Pasivos · signos invertidos
    if (c > f) difDeducible = c - f;
    if (c < f) difImponible = f - c;
  }

  const idActivo = redondear(difDeducible * tarifa);
  const idPasivo = redondear(difImponible * tarifa);

  return {
    categoria,
    baseContable,
    baseFiscal,
    difDeducible,
    difImponible,
    idActivo,
    idPasivo,
  };
}

export type IDResumen = {
  totalActivoID: number;
  totalPasivoID: number;
  /** Gasto (positivo) o Ingreso (negativo) por impuesto diferido neto. */
  gastoIngresoNeto: number;
};

/**
 * Resumen de las filas calculadas:
 *   Total ID-A = suma de todos los idActivo
 *   Total ID-P = suma de todos los idPasivo
 *   Neto       = ID-P − ID-A  (positivo → gasto · negativo → ingreso)
 */
export function resumenID(filas: ReadonlyArray<IDFilaCalculada>): IDResumen {
  const totalActivoID = filas.reduce((s, f) => s + f.idActivo, 0);
  const totalPasivoID = filas.reduce((s, f) => s + f.idPasivo, 0);
  return {
    totalActivoID,
    totalPasivoID,
    gastoIngresoNeto: totalPasivoID - totalActivoID,
  };
}
