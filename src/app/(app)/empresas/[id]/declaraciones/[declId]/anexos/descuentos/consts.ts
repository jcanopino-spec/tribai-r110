// Constantes para el Anexo 4 · Descuentos Tributarios

export type DescuentoState = { error: string | null; ok: boolean };

export type Categoria = "impuestos_exterior" | "donaciones" | "otros";

export const CATEGORIAS: { id: Categoria; label: string }[] = [
  { id: "impuestos_exterior", label: "Impuestos pagados en el exterior" },
  { id: "donaciones", label: "Donaciones" },
  { id: "otros", label: "Otros descuentos" },
];

// Plantillas de descuentos comunes extraídas del .xlsm Anexo 4.
// El usuario puede usar estas o escribir uno propio.
export const PLANTILLAS: Record<
  Categoria,
  { descripcion: string; normatividad: string }[]
> = {
  impuestos_exterior: [
    {
      descripcion: "Descuento por impuestos pagados en el exterior",
      normatividad: "Art. 254 E.T.",
    },
    {
      descripcion: "Descuento por impuestos pagados en el exterior — ganancias ocasionales",
      normatividad: "Art. 254 E.T. (G.O.)",
    },
  ],
  donaciones: [
    {
      descripcion: "Donaciones dirigidas a programas de Investigación, Desarrollo Tecnológico e Innovación",
      normatividad: "Art. 256 E.T., Parágrafo 1° y 2° del 158-1 E.T.",
    },
    {
      descripcion: "Inversiones en investigación, desarrollo tecnológico e innovación (30%)",
      normatividad: "Art. 256 E.T.",
    },
    {
      descripcion: "Donaciones a entidades sin ánimo de lucro (25%)",
      normatividad: "Art. 257 E.T.",
    },
    {
      descripcion: "Donaciones efectuadas a la Red Nacional de Bibliotecas Públicas",
      normatividad: "Art. 257 par., Ley 1819/2016",
    },
    {
      descripcion: "Donaciones para becas a deportistas",
      normatividad: "Art. 177 Ley 1498 de 2011",
    },
  ],
  otros: [
    {
      descripcion: "50% del impuesto de industria y comercio (ICA), avisos y tableros pagado",
      normatividad: "Art. 115 E.T. (modificado por art. 86 Ley 2010/2019)",
    },
    {
      descripcion: "Descuento empresas de servicios públicos por inversión en acueducto y alcantarillado",
      normatividad: "Art. 104 Ley 788/2002",
    },
    {
      descripcion: "IVA pagado en la importación o adquisición de bienes de capital",
      normatividad: "Art. 258-1 E.T.",
    },
    {
      descripcion: "Descuento por inversiones realizadas en control y mejoramiento del medio ambiente",
      normatividad: "Art. 255 E.T.",
    },
  ],
};
