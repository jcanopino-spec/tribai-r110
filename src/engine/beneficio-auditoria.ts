// Beneficio de auditoría · Art. 689-3 E.T.
// Reduce el plazo de firmeza de 3 años a 12 o 6 meses si la declaración
// cumple los requisitos de incremento del impuesto neto y oportunidad.

export type BeneficioAuditoria = {
  /** Plazo de firmeza efectivo en meses (12, 6 o 36 = sin beneficio = firmeza ordinaria 3 años). */
  mesesFirmeza: number;
  /** ¿Cumple los requisitos? */
  cumpleRequisitos: boolean;
  /** Incremento porcentual del impuesto neto vs el año anterior (0..1). */
  incremento: number;
  /** Razón por la que no aplica si cumpleRequisitos = false. */
  razon: string | null;
};

/**
 * Evalúa si la declaración cumple los requisitos para el beneficio de auditoría
 * del Art. 689-3 E.T. AG 2025:
 * - 12 meses de firmeza si impuesto_neto_actual ≥ 25% más que el del año anterior.
 * - 6 meses de firmeza si impuesto_neto_actual ≥ 35% más.
 * - Adicionalmente, el impuesto del año anterior debe ser >= 71 UVT (sancion mínima * 7).
 *   Para simplificar usamos un umbral mínimo de impuesto AG anterior > 0.
 * - La declaración debe presentarse dentro del plazo legal (oportuna, no extemporánea).
 */
export function evaluarBeneficioAuditoria(args: {
  impuestoNetoActual: number;
  impuestoNetoAnterior: number;
  pidio12m: boolean;
  pidio6m: boolean;
  presentacionOportuna: boolean;
}): BeneficioAuditoria {
  const { impuestoNetoActual, impuestoNetoAnterior, pidio12m, pidio6m, presentacionOportuna } = args;

  if (!pidio12m && !pidio6m) {
    return { mesesFirmeza: 36, cumpleRequisitos: true, incremento: 0, razon: null };
  }

  if (impuestoNetoAnterior <= 0) {
    return {
      mesesFirmeza: 36,
      cumpleRequisitos: false,
      incremento: 0,
      razon: "El impuesto neto del año gravable anterior es cero o no se registró.",
    };
  }

  if (!presentacionOportuna) {
    return {
      mesesFirmeza: 36,
      cumpleRequisitos: false,
      incremento: 0,
      razon: "La declaración no se presentó oportunamente. El beneficio requiere presentación dentro del plazo.",
    };
  }

  const incremento = (impuestoNetoActual - impuestoNetoAnterior) / impuestoNetoAnterior;

  if (pidio6m) {
    if (incremento >= 0.35) {
      return { mesesFirmeza: 6, cumpleRequisitos: true, incremento, razon: null };
    }
    if (pidio12m && incremento >= 0.25) {
      return { mesesFirmeza: 12, cumpleRequisitos: true, incremento, razon: null };
    }
    return {
      mesesFirmeza: 36,
      cumpleRequisitos: false,
      incremento,
      razon: `Incremento del ${(incremento * 100).toFixed(2)}% es menor al 35% requerido para 6 meses de firmeza.`,
    };
  }

  // Solo pidió 12 meses
  if (incremento >= 0.25) {
    return { mesesFirmeza: 12, cumpleRequisitos: true, incremento, razon: null };
  }
  return {
    mesesFirmeza: 36,
    cumpleRequisitos: false,
    incremento,
    razon: `Incremento del ${(incremento * 100).toFixed(2)}% es menor al 25% requerido para 12 meses de firmeza.`,
  };
}
