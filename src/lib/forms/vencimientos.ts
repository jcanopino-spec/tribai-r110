// Helpers para vencimientos del Formulario 110.
// El vencimiento depende del último dígito del NIT y del tipo de contribuyente.
// El catálogo está en la tabla `vencimientos_form110`.

export type EstadoPresentacion =
  | { estado: "no_presentada"; vencimiento: string | null }
  | {
      estado: "oportuna" | "extemporanea";
      vencimiento: string;
      presentacion: string;
      diasDiferencia: number;
      mesesExtemporanea: number;
    };

export function ultimoDigitoNit(nit: string | null | undefined): number | null {
  if (!nit) return null;
  const d = String(nit).replace(/\D/g, "");
  if (!d) return null;
  return Number(d[d.length - 1]);
}

/**
 * Compara fecha de presentación contra fecha de vencimiento.
 * Si la presentación es null, devuelve estado 'no_presentada'.
 * Si llega antes o igual al vencimiento → oportuna.
 * Si llega después → extemporánea (incluye meses-fracción de retraso).
 */
export function evaluarPresentacion(
  fechaVencimiento: string | null | undefined,
  fechaPresentacion: string | null | undefined,
): EstadoPresentacion {
  if (!fechaPresentacion) {
    return { estado: "no_presentada", vencimiento: fechaVencimiento ?? null };
  }
  if (!fechaVencimiento) {
    return { estado: "no_presentada", vencimiento: null };
  }
  const venc = new Date(fechaVencimiento + "T00:00:00");
  const pres = new Date(fechaPresentacion + "T00:00:00");
  const ms = pres.getTime() - venc.getTime();
  const dias = Math.round(ms / (1000 * 60 * 60 * 24));

  if (dias <= 0) {
    return {
      estado: "oportuna",
      vencimiento: fechaVencimiento,
      presentacion: fechaPresentacion,
      diasDiferencia: dias,
      mesesExtemporanea: 0,
    };
  }
  // Cada mes o fracción cuenta para la sanción
  const mesesExtemporanea = Math.ceil(dias / 30);
  return {
    estado: "extemporanea",
    vencimiento: fechaVencimiento,
    presentacion: fechaPresentacion,
    diasDiferencia: dias,
    mesesExtemporanea,
  };
}
