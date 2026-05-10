// F2516 · Hoja 7 · Resumen ESF / ERI
//
// Vista derivada · agrega los totales de H2 (ESF), H3 (ERI), H4 (Imp Dif),
// H5 (Ingresos), H6 (Activos Fijos) y los cruza contra el Formulario 110.
// No tiene captura propia.

import type { F2516FilaCalculada } from "@/lib/f2516-aggregates";
import type { F2516H4Resumen } from "@/engine/f2516-h4";
import type { F2516H5Resumen } from "@/engine/f2516-h5";
import type { F2516H6Resumen } from "@/engine/f2516-h6";

export type CruceH7 = {
  id: string;
  desc: string;
  fuente2516: number;
  fuenteF110: number;
  diferencia: number;
  ok: boolean;
};

export type F2516H7Resumen = {
  // Totales del ESF (de H2 vía F2516_FILAS)
  totalActivos: number;
  totalPasivos: number;
  patrimonioLiquido: number;
  // Totales del ERI (de H3)
  totalIngresos: number;
  totalCostos: number;
  totalGastos: number;
  utilidadAntesImpuestos: number;
  impuestoRenta: number;
  resultadoEjercicio: number;
  // De H5
  ingresosH5: number;
  // De H6
  activosFijosContables: number;
  activosFijosFiscales: number;
  // De H4
  totalATD: number;
  totalPTD: number;
  impuestoDiferidoNeto: number;
  // Cruces contra F110
  cruces: CruceH7[];
};

const TOLERANCIA = 1000;

export function computarH7(input: {
  filasESF: F2516FilaCalculada[];
  resumenH4: F2516H4Resumen;
  resumenH5: F2516H5Resumen;
  resumenH6: F2516H6Resumen;
  valoresF110: Map<number, number>;
  impuestoRenta: number;
}): F2516H7Resumen {
  const byId = new Map<string, F2516FilaCalculada>();
  for (const f of input.filasESF) byId.set(f.fila.id, f);

  const totalActivos = byId.get("ESF_09_TOTAL_ACT")?.fiscal ?? 0;
  const totalPasivos = byId.get("ESF_10_PASIVOS")?.fiscal ?? 0;
  const patrimonioLiquido = totalActivos - totalPasivos;

  // ERI · usa los IDs reales del catálogo F2516_FILAS
  const totalIngresos = byId.get("ERI_12_INGRESOS")?.fiscal ?? 0;
  const totalCostos = byId.get("ERI_16_COSTOS")?.fiscal ?? 0;
  // Los gastos R63-R66 no están en el F2516 compacto · vienen del F110
  const totalGastos =
    (input.valoresF110.get(63) ?? 0) +
    (input.valoresF110.get(64) ?? 0) +
    (input.valoresF110.get(65) ?? 0) +
    (input.valoresF110.get(66) ?? 0);
  const utilidadAntesImpuestos = totalIngresos - totalCostos - totalGastos;
  const impuestoRenta = input.impuestoRenta;
  const resultadoEjercicio = utilidadAntesImpuestos - impuestoRenta;

  // Cruces contra F110
  const r44 = input.valoresF110.get(44) ?? 0;
  const r45 = input.valoresF110.get(45) ?? 0;
  const r46 = input.valoresF110.get(46) ?? 0;
  const r58 = input.valoresF110.get(58) ?? 0;
  const r62 = input.valoresF110.get(62) ?? 0;
  const r63a66 =
    (input.valoresF110.get(63) ?? 0) +
    (input.valoresF110.get(64) ?? 0) +
    (input.valoresF110.get(65) ?? 0) +
    (input.valoresF110.get(66) ?? 0);
  const r96 = input.valoresF110.get(96) ?? 0;
  const r40_42 =
    (input.valoresF110.get(40) ?? 0) + (input.valoresF110.get(42) ?? 0);
  const r47_57 =
    (input.valoresF110.get(47) ?? 0) + (input.valoresF110.get(57) ?? 0);

  const cruces: CruceH7[] = [
    cruce("V1", "Total activos = R44", totalActivos, r44),
    cruce("V2", "Total pasivos = R45", totalPasivos, r45),
    cruce("V3", "Patrimonio líquido = R46", patrimonioLiquido, r46),
    cruce("V4", "Total ingresos = R58", totalIngresos, r58),
    cruce("V5", "Total costos = R62", totalCostos, r62),
    cruce("V6", "Total gastos = R63+R64+R65+R66", totalGastos, r63a66),
    cruce("V7", "Impuesto = R96", impuestoRenta, r96),
    cruce(
      "V8",
      "Activos fijos H6 = R40+R42",
      input.resumenH6.totalContable,
      r40_42,
    ),
    cruce(
      "V9",
      "Ingresos H5 = R47+R57",
      input.resumenH5.ingresosBrutosNetos,
      r47_57,
    ),
  ];

  return {
    totalActivos,
    totalPasivos,
    patrimonioLiquido,
    totalIngresos,
    totalCostos,
    totalGastos,
    utilidadAntesImpuestos,
    impuestoRenta,
    resultadoEjercicio,
    ingresosH5: input.resumenH5.ingresosBrutosNetos,
    activosFijosContables: input.resumenH6.totalContable,
    activosFijosFiscales: input.resumenH6.totalFiscal,
    totalATD: input.resumenH4.totalATD,
    totalPTD: input.resumenH4.totalPTD,
    impuestoDiferidoNeto: input.resumenH4.impuestoDiferidoNeto,
    cruces,
  };
}

function cruce(id: string, desc: string, a: number, b: number): CruceH7 {
  const dif = a - b;
  return {
    id,
    desc,
    fuente2516: a,
    fuenteF110: b,
    diferencia: dif,
    ok: Math.abs(dif) <= TOLERANCIA,
  };
}
