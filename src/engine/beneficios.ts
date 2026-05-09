// Catálogo de Beneficios Tributarios Especiales · vista informativa.
//
// Replica la hoja "Anexo Beneficios" del .xlsm guía v5: 7 beneficios
// que el contador puede aplicar a la empresa, cada uno con su base
// legal y su tarifa típica.
//
// IMPORTANTE: la mayoría de estos beneficios NO se modelan en un
// renglón propio del F110, sino que se reflejan eligiendo el régimen
// correcto en la empresa (la tabla `regimenes_tarifas` tiene los
// códigos 03 ZESE, 04/05/06 ZF, 09-12 tarifas especiales). Esta
// vista existe para que el contador identifique RÁPIDO qué
// beneficios son compatibles con el régimen elegido y verifique que
// la configuración es coherente.

export type BeneficioId =
  | "ECON_NARANJA"
  | "DESARR_RURAL"
  | "ZESE"
  | "ZOMAC"
  | "HOTELES"
  | "EDITORIALES"
  | "ZONA_FRANCA";

export type BeneficioModalidad =
  /** Renta exenta · se captura en el Anexo de Rentas Exentas (Anexo 19), R77 */
  | "renta_exenta"
  /** Tarifa especial reducida (ej. hoteles 9%) · se elige el régimen específico */
  | "tarifa_especial"
  /** Régimen completo · ZESE 0%, Zona Franca, etc. · cambia toda la liquidación */
  | "regimen_completo";

export type Beneficio = {
  id: BeneficioId;
  numero: number;
  nombre: string;
  baseLegal: string;
  /** Códigos de regimenes_tarifas que canalizan este beneficio. */
  regimenesAplicables: string[];
  /** Tarifa típica (0..1). null si depende de la subdivisión del beneficio. */
  tarifaTipica: number | null;
  modalidad: BeneficioModalidad;
  descripcion: string;
};

export const BENEFICIOS: readonly Beneficio[] = [
  {
    id: "ECON_NARANJA",
    numero: 1,
    nombre: "Economía Naranja",
    baseLegal: "Art. 235-2 #1 E.T.",
    regimenesAplicables: [],
    tarifaTipica: 0,
    modalidad: "renta_exenta",
    descripcion:
      "Empresas de industrias creativas y culturales · renta exenta hasta por 7 años. Se captura como renta exenta en el Anexo 19 (R77).",
  },
  {
    id: "DESARR_RURAL",
    numero: 2,
    nombre: "Desarrollo rural (agro)",
    baseLegal: "Art. 235-2 #2 E.T.",
    regimenesAplicables: [],
    tarifaTipica: 0,
    modalidad: "renta_exenta",
    descripcion:
      "Empresas de actividades agropecuarias en zonas rurales · renta exenta. Se captura como renta exenta en el Anexo 19 (R77).",
  },
  {
    id: "ZESE",
    numero: 3,
    nombre: "ZESE · La Guajira, Norte de Santander, Arauca",
    baseLegal: "Ley 1955/2019",
    regimenesAplicables: ["03"],
    tarifaTipica: 0,
    modalidad: "regimen_completo",
    descripcion:
      "Zonas Económicas Especiales · tarifa 0% por 5 años + 50% del general por 5 años más. Se aplica eligiendo el régimen 03 en la empresa.",
  },
  {
    id: "ZOMAC",
    numero: 4,
    nombre: "ZOMAC · micro y pequeñas empresas",
    baseLegal: "Ley 1819/2016 art. 237",
    regimenesAplicables: [],
    tarifaTipica: null,
    modalidad: "tarifa_especial",
    descripcion:
      "Zonas Más Afectadas por el Conflicto · tarifa progresiva (0% a 5 años · 50% del general años 6-8 · 75% años 9-10). Hoy no hay un código de régimen específico — captura como renta exenta o ajusta tarifa manualmente.",
  },
  {
    id: "HOTELES",
    numero: 5,
    nombre: "Hoteles nuevos o remodelados",
    baseLegal: "Art. 240 par. 5 E.T.",
    regimenesAplicables: ["09"],
    tarifaTipica: 0.09,
    modalidad: "tarifa_especial",
    descripcion:
      "Servicios hoteleros prestados en nuevos hoteles construidos o remodelados · tarifa 9%. Se aplica eligiendo el régimen 09 en la empresa.",
  },
  {
    id: "EDITORIALES",
    numero: 6,
    nombre: "Empresas editoriales",
    baseLegal: "Ley 98/1993",
    regimenesAplicables: ["11"],
    tarifaTipica: 0.09,
    modalidad: "tarifa_especial",
    descripcion:
      "Empresas dedicadas a la edición de libros · tarifa 9% (Par. 4 Art. 240 E.T.). Se aplica eligiendo el régimen 11 en la empresa.",
  },
  {
    id: "ZONA_FRANCA",
    numero: 7,
    nombre: "Zona Franca",
    baseLegal: "Ley 1004/2005",
    regimenesAplicables: ["04", "05", "06"],
    tarifaTipica: 0.20,
    modalidad: "regimen_completo",
    descripcion:
      "Usuarios industriales/comerciales de zonas francas · tarifa 20% (no comerciales) · 35% (comerciales) · 15% (Cúcuta). Se aplica eligiendo el régimen 04/05/06.",
  },
];

/**
 * Devuelve los beneficios "ligados" al régimen elegido. Solo aplica
 * para beneficios cuya `regimenesAplicables` incluya el código.
 *
 * Beneficios de modalidad "renta_exenta" o "tarifa_especial" sin código
 * directo (Economía Naranja, Desarrollo Rural, ZOMAC) no se devuelven
 * acá — esos se gestionan vía el Anexo 19 (rentas exentas) o ajuste manual.
 */
export function beneficiosAplicablesPorRegimen(
  codigoRegimen: string | null | undefined,
): BeneficioId[] {
  if (!codigoRegimen) return [];
  const c = String(codigoRegimen).padStart(2, "0");
  return BENEFICIOS.filter((b) => b.regimenesAplicables.includes(c)).map((b) => b.id);
}

/**
 * Lookup directo por id.
 */
export function getBeneficio(id: BeneficioId): Beneficio | undefined {
  return BENEFICIOS.find((b) => b.id === id);
}
