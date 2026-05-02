// Anexo 8 · Ganancia Ocasional

export type GoState = { error: string | null; ok: boolean };

export type Categoria =
  | "activo_fijo"
  | "inversion"
  | "rifa_loteria"
  | "herencia_legado"
  | "liquidacion_sociedad"
  | "exterior";

export const CATEGORIAS: { id: Categoria; label: string; descripcion: string }[] = [
  {
    id: "activo_fijo",
    label: "Venta de activos fijos poseídos por 2+ años",
    descripcion: "Inmuebles, vehículos, maquinaria. Costo + recuperación de depreciación.",
  },
  {
    id: "inversion",
    label: "Inversiones (acciones, derechos)",
    descripcion: "Venta de acciones, cuotas o derechos sociales poseídos por 2+ años.",
  },
  {
    id: "rifa_loteria",
    label: "Rifas, loterías y similares",
    descripcion: "Premios, rifas, loterías, apuestas. Tarifa especial en algunos casos.",
  },
  {
    id: "herencia_legado",
    label: "Herencias, legados y donaciones",
    descripcion: "Activos recibidos por sucesión o donación.",
  },
  {
    id: "liquidacion_sociedad",
    label: "Liquidación de sociedades poseídas 2+ años",
    descripcion: "Reparto del exceso del capital aportado.",
  },
  {
    id: "exterior",
    label: "Ganancias ocasionales en el exterior",
    descripcion: "Operaciones generadas fuera del país.",
  },
];

// Si la categoría debe pedir costo fiscal y no_gravada (todas excepto rifas/herencias/liquidación)
export function pideCostoFiscal(c: Categoria): boolean {
  return c === "activo_fijo" || c === "inversion" || c === "exterior";
}
