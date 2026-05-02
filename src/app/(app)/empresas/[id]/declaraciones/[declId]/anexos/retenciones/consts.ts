// Constantes y tipos para el Anexo 3 (Retenciones / Autorretenciones).
// Separado de actions.ts porque archivos con "use server" solo pueden
// exportar async functions.

export type RetencionState = { error: string | null; ok: boolean };

export const CONCEPTOS_RETENCION = [
  "Por ventas",
  "Por servicios",
  "Por honorarios y comisiones",
  "Por rendimientos financieros",
  "Por dividendos y participaciones",
  "Retenciones Ganancias Ocasionales",
  "Otras retenciones",
] as const;

export const CONCEPTOS_AUTORRETENCION = [
  "Autorretención Decreto 2201 del 2016",
  "Por ventas",
  "Por servicios",
  "Por honorarios y comisiones",
  "Otras autorretenciones",
] as const;
