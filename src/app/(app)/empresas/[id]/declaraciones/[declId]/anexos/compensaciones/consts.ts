// Anexo 20 · Compensación de Pérdidas (Renglón 74)

export type State = { error: string | null; ok: boolean };

export type Tipo = "perdida" | "exceso_rp";

export const TIPOS: { id: Tipo; label: string; help: string }[] = [
  {
    id: "perdida",
    label: "Pérdida fiscal",
    help: "Pérdidas líquidas de ejercicios anteriores (Art. 147 E.T.). Compensables hasta 12 años.",
  },
  {
    id: "exceso_rp",
    label: "Exceso de renta presuntiva",
    help: "Excesos de renta presuntiva sobre renta líquida ordinaria de años anteriores. Compensables hasta 5 años.",
  },
];
