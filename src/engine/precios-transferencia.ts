// Precios de Transferencia · Arts. 260-1 a 260-11 E.T.
//
// Las personas jurídicas con vinculados económicos del exterior o
// con operaciones en paraísos fiscales pueden estar obligadas a:
//
//   1) Presentar Declaración Informativa de PT (Formato 1125)
//   2) Preparar Documentación Comprobatoria (Estudios PT)
//
// Umbrales para obligación (Art. 260-9 E.T. + Decreto reglamentario):
//
//   - Patrimonio bruto al 31-dic AG anterior >= 100.000 UVT
//     OR
//   - Ingresos brutos AG actual >= 61.000 UVT
//
// Si cualquiera se cumple, hay obligación.

export const UMBRAL_PATRIMONIO_UVT = 100_000;
export const UMBRAL_INGRESOS_UVT = 61_000;

export type ObligacionPT = {
  obligado: boolean;
  patrimonioActual: number;
  patrimonioUmbral: number;
  patrimonioSupera: boolean;
  ingresosActual: number;
  ingresosUmbral: number;
  ingresosSupera: boolean;
  /** Causa de la obligación si está obligado. */
  causa: string | null;
};

export function evaluarObligacionPT(args: {
  /** Patrimonio bruto al 31-dic del AG anterior. */
  patrimonioBrutoAnterior: number;
  /** Ingresos brutos del AG actual (R58 del 110). */
  ingresosBrutosActual: number;
  /** UVT del AG anterior (para el umbral de patrimonio). */
  uvtAnterior: number;
  /** UVT del AG actual (para el umbral de ingresos). */
  uvtActual: number;
}): ObligacionPT {
  const patrimonioUmbral = UMBRAL_PATRIMONIO_UVT * args.uvtAnterior;
  const ingresosUmbral = UMBRAL_INGRESOS_UVT * args.uvtActual;

  const patrimonioSupera = args.patrimonioBrutoAnterior >= patrimonioUmbral;
  const ingresosSupera = args.ingresosBrutosActual >= ingresosUmbral;

  const obligado = patrimonioSupera || ingresosSupera;
  let causa: string | null = null;
  if (patrimonioSupera && ingresosSupera) {
    causa = "Patrimonio e ingresos superan ambos umbrales.";
  } else if (patrimonioSupera) {
    causa = `Patrimonio bruto AG anterior supera 100.000 UVT.`;
  } else if (ingresosSupera) {
    causa = `Ingresos brutos AG actual superan 61.000 UVT.`;
  }

  return {
    obligado,
    patrimonioActual: args.patrimonioBrutoAnterior,
    patrimonioUmbral,
    patrimonioSupera,
    ingresosActual: args.ingresosBrutosActual,
    ingresosUmbral,
    ingresosSupera,
    causa,
  };
}

/**
 * Métodos PT permitidos (Art. 260-3 E.T.).
 */
export const METODOS_PT = [
  { codigo: "PC", nombre: "Precio Comparable No Controlado" },
  { codigo: "PR", nombre: "Precio de Reventa" },
  { codigo: "CA", nombre: "Costo Adicionado" },
  { codigo: "MTU", nombre: "Márgenes Transaccionales de Utilidad" },
  { codigo: "PU", nombre: "Partición de Utilidades" },
  { codigo: "RPU", nombre: "Residual de Partición de Utilidades" },
] as const;

export type MetodoPT = (typeof METODOS_PT)[number]["codigo"];
