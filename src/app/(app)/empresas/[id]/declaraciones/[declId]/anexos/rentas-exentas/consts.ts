// Anexo 19 · Rentas Exentas

export type State = { error: string | null; ok: boolean };

// Plantillas extraídas del .xlsm Anexo 19 (Art. 235-2 ET y otros)
export const PLANTILLAS = [
  { d: "Empresas de Economía Naranja", n: "Art. 235-2 ET, Numeral 1°" },
  { d: "Rentas provenientes de inversiones que incrementen la productividad del sector agropecuario", n: "Art. 235-2 ET, Numeral 2°" },
  { d: "Venta de energía eléctrica generada con base en energías renovables", n: "Art. 235-2 ET, Numeral 3°" },
  { d: "Rentas asociadas a la vivienda de interés social y prioritario", n: "Art. 235-2 ET, Numeral 4°" },
  { d: "Aprovechamiento de nuevas plantaciones forestales", n: "Art. 235-2 ET, Numeral 5°" },
  { d: "Rentas provenientes de plantaciones de árboles maderables", n: "Art. 235-2 ET, Numeral 5°" },
  { d: "Prestación del servicio de transporte fluvial con embarcaciones de bajo calado", n: "Art. 235-2 ET, Numeral 6°" },
  { d: "Rentas exentas de los Arts. 4° y 5° del Decreto 841 de 1998", n: "Art. 235-2 ET, Numeral 7°" },
  { d: "Incentivo tributario a las creaciones literarias de la economía naranja", n: "Art. 235-2 ET, Numeral 8°" },
  { d: "Rendimientos generados por la reserva de estabilización", n: "Art. 101 Ley 100/1993" },
  { d: "Rentas exentas de la Decisión 578 de la CAN", n: "Art. 235-2 ET, Inc. 1°" },
  { d: "Rentas exentas reconocidas en otros convenios internacionales", n: "Art. 235-2 ET, Inc. 1°" },
  { d: "Dividendos distribuidos por sociedades nacionales (CHC)", n: "Par. 2°, Art. 242-1 ET" },
  { d: "Beneficio o excedente neto de Entidades Sin Ánimo de Lucro (ESAL)", n: "Art. 358 ET" },
  { d: "Rentas exentas por servicios prestados en hoteles", n: "Art. 207-2 num 3 y 4 ET" },
];
