"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda los 3 ajustes (conversion, menor_fiscal, mayor_fiscal) y la
 * observación de una fila del Formato 2516.
 *
 * Insert/update por (declaracion_id, fila_id). Si todos los ajustes son 0
 * y observación vacía, BORRA el registro para no acumular filas vacías.
 */
export async function saveAjusteAction(
  declId: string,
  empresaId: string,
  filaId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const parseNum = (v: FormDataEntryValue | null): number => {
    const s = String(v ?? "").replace(/[^0-9.\-]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const conversion = parseNum(formData.get("conversion"));
  const menor = parseNum(formData.get("menor_fiscal"));
  const mayor = parseNum(formData.get("mayor_fiscal"));
  const observacion =
    String(formData.get("observacion") ?? "").trim() || null;

  // Si todo está en cero/vacío, borra el registro
  if (conversion === 0 && menor === 0 && mayor === 0 && !observacion) {
    const { error } = await supabase
      .from("formato_2516_ajustes")
      .delete()
      .eq("declaracion_id", declId)
      .eq("fila_id", filaId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("formato_2516_ajustes").upsert(
      {
        declaracion_id: declId,
        fila_id: filaId,
        conversion,
        menor_fiscal: menor,
        mayor_fiscal: mayor,
        observacion,
      },
      { onConflict: "declaracion_id,fila_id" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(
    `/empresas/${empresaId}/declaraciones/${declId}`,
    "layout",
  );
  return { ok: true };
}
