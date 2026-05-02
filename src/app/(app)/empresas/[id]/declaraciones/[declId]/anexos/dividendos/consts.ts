// Anexo 18 · Ingresos por Dividendos

export type State = { error: string | null; ok: boolean };

export const CATEGORIAS = [
  {
    id: "no_constitutivos",
    renglon: 49,
    label: "No constitutivos de renta ni GO",
    short: "No constitutivos",
  },
  {
    id: "distribuidos_no_residentes",
    renglon: 50,
    label: "Distribuidos por entidades no residentes",
    short: "No residentes",
  },
  {
    id: "gravados_tarifa_general",
    renglon: 51,
    label: "Gravados a la tarifa general",
    short: "Tarifa general",
  },
  {
    id: "gravados_persona_natural_dos",
    renglon: 52,
    label: "Gravados recibidos por persona natural (residente)",
    short: "P. natural res.",
  },
  {
    id: "gravados_personas_extranjeras",
    renglon: 53,
    label: "Gravados recibidos por personas no residentes",
    short: "No residentes (PN)",
  },
  {
    id: "gravados_art_245",
    renglon: 54,
    label: "Gravados a tarifas de los Arts. 245 (no residentes)",
    short: "Art. 245",
  },
  {
    id: "gravados_tarifa_l1819",
    renglon: 55,
    label: "Gravados a tarifa general según Ley 1819/2016",
    short: "Ley 1819",
  },
  {
    id: "gravados_proyectos",
    renglon: 56,
    label: "Provenientes de proyectos calificados",
    short: "Proyectos calif.",
  },
] as const;

export type CategoriaId = (typeof CATEGORIAS)[number]["id"];
