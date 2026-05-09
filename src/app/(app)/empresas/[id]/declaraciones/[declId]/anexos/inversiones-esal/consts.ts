// Anexo Inversiones ESAL · alimenta R68 (efectuadas) y R69 (liquidadas)
// del Formulario 110. Solo aplica para empresas en régimen 08 (ESAL).

export type State = { error: string | null; ok: boolean };

export const ESTADO_INICIAL: State = { error: null, ok: false };

export type TipoInversion = "efectuada" | "liquidada";

export type InversionEsalItem = {
  id: number;
  tipo: TipoInversion;
  fecha: string | null;
  ano_origen: number | null;
  concepto: string;
  categoria: string | null;
  valor: number;
  observacion: string | null;
};

/**
 * Categorías típicas de inversión que las ESAL hacen para aplicar la
 * deducción del Art. 358 E.T. (50% del beneficio neto reinvertido).
 */
export const CATEGORIAS_ESAL = [
  "Activos fijos productivos",
  "Programa social",
  "Dotación / mejoras",
  "Investigación y desarrollo",
  "Capital de trabajo del programa",
  "Otra",
] as const;
