// Carga los totales de Seguridad Social desde el anexo (por empleado) y
// los devuelve listos para alimentar R33/R34/R35 del Formulario 110.
//
// Lógica:
//   - Si hay registros en anexo_seg_social → totales calculados automáticamente
//   - Si no hay → usa los valores manuales de declaracion.total_nomina /
//     aportes_seg_social / aportes_para_fiscales (fallback backward-compat)
//
// Mapeo a renglones del 110:
//   R33 = total salarios          → suma de salario
//   R34 = aportes seg social      → suma de aporte_salud + aporte_pension + aporte_arl
//   R35 = aportes parafiscales    → suma de aporte_parafiscales

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

export type SegSocialTotals = {
  totalNomina: number;
  aportesSegSocial: number;
  aportesParaFiscales: number;
  /** true si los totales vienen del anexo, false si son manuales del config */
  fromAnexo: boolean;
};

type DeclMin = {
  total_nomina: number | string | null;
  aportes_seg_social: number | string | null;
  aportes_para_fiscales: number | string | null;
};

export async function loadSegSocialTotals(
  supabase: SupabaseClient<Database>,
  declId: string,
  declaracion: DeclMin,
): Promise<SegSocialTotals> {
  const { data: empleados } = await supabase
    .from("anexo_seg_social")
    .select("salario, aporte_salud, aporte_pension, aporte_arl, aporte_parafiscales")
    .eq("declaracion_id", declId);

  const filas = empleados ?? [];

  if (filas.length > 0) {
    const totalNomina = filas.reduce((s, e) => s + Number(e.salario), 0);
    const aportesSegSocial = filas.reduce(
      (s, e) =>
        s +
        Number(e.aporte_salud) +
        Number(e.aporte_pension) +
        Number(e.aporte_arl),
      0,
    );
    const aportesParaFiscales = filas.reduce(
      (s, e) => s + Number(e.aporte_parafiscales),
      0,
    );
    return {
      totalNomina,
      aportesSegSocial,
      aportesParaFiscales,
      fromAnexo: true,
    };
  }

  // Fallback: usa valores manuales de configuración
  return {
    totalNomina: Number(declaracion.total_nomina ?? 0),
    aportesSegSocial: Number(declaracion.aportes_seg_social ?? 0),
    aportesParaFiscales: Number(declaracion.aportes_para_fiscales ?? 0),
    fromAnexo: false,
  };
}
