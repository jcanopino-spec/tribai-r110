// Helper para cargar los inputs adicionales que la fórmula DIAN de
// Tasa Mínima de Tributación (TTD) necesita y que no están en el
// engine puro: utilidad contable neta y suma de diferencias
// permanentes que aumentan la renta.
//
// Usado por todos los callers de computarRenglones (page.tsx del editor,
// formulario-110, imprimir, validaciones, conciliacion-patrimonial)
// para evitar duplicar la lógica de carga.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

type Decl = {
  utilidad_contable: number | string | null;
  perdida_contable: number | string | null;
};

export type TasaMinimaInputsCtx = {
  utilidadContableNeta: number;
  difPermanentesAumentan: number;
};

/**
 * Calcula los inputs auxiliares para la fórmula TTD a partir de la
 * declaración + las partidas de conciliación de utilidad ya guardadas.
 *
 * - `utilidadContableNeta` = utilidad_contable − perdida_contable
 * - `difPermanentesAumentan` = Σ partidas manuales tipo='permanente' signo='mas'
 *
 * Las auto-partidas que ya están reflejadas en R93 (descuentos), R74
 * (compensaciones), R77 (rentas exentas), R60 (INCRNGO), R83 (GO
 * gravable) NO se incluyen aquí — son consumidas por separado en la
 * fórmula DIAN.
 */
export async function loadTasaMinimaInputs(
  supabase: SupabaseClient<Database>,
  declId: string,
  declaracion: Decl,
): Promise<TasaMinimaInputsCtx> {
  const utilidadContableNeta =
    Number(declaracion.utilidad_contable ?? 0) -
    Number(declaracion.perdida_contable ?? 0);

  const { data: partidas } = await supabase
    .from("conciliacion_partidas")
    .select("tipo, signo, valor")
    .eq("declaracion_id", declId)
    .eq("tipo", "permanente")
    .eq("signo", "mas");

  const difPermanentesAumentan = (partidas ?? []).reduce(
    (s, p) => s + Number(p.valor),
    0,
  );

  return { utilidadContableNeta, difPermanentesAumentan };
}
