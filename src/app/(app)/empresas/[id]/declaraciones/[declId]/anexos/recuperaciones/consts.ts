// Anexo 17 (simplificado) · Renta por recuperación de deducciones · R70

export type State = { error: string | null; ok: boolean };

// Conceptos comunes de recuperaciones que alimentan R70.
export const PLANTILLAS = [
  { c: "Recuperación de deterioros", d: "Reversión del deterioro de cartera deducido fiscalmente en años anteriores" },
  { c: "Recuperación de provisiones", d: "Reversión de provisiones contables que en años anteriores se reconocieron como deducción" },
  { c: "Recuperación de depreciación", d: "Mayor valor reconocido fiscalmente sobre activos vendidos o dados de baja" },
  { c: "Recuperación de pasivos estimados", d: "Reversión de pasivos estimados que disminuyeron rentas en años anteriores" },
  { c: "Recuperación de cartera castigada", d: "Recuperaciones efectivas de cartera que ya había sido provisionada y deducida" },
  { c: "Recuperación de gastos no procedentes", d: "Devolución de gastos rechazados fiscalmente en años anteriores" },
  { c: "Otra recuperación de deducciones", d: "Cualquier otro ingreso fiscal por reversión de partida deducida en años anteriores" },
];
