"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateDeclaracion } from "@/lib/revalidate";

export type SaveH1State = { ok: boolean; error: string | null };

export async function saveH1Action(
  declId: string,
  empresaId: string,
  _prev: SaveH1State,
  formData: FormData,
): Promise<SaveH1State> {
  const supabase = await createClient();

  const get = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? null : String(v);
  };
  const getBool = (k: string) => formData.get(k) === "on";

  const payload = {
    declaracion_id: declId,
    rep_legal_nombre: get("rep_legal_nombre"),
    rep_legal_tipo_doc: get("rep_legal_tipo_doc") ?? "CC",
    rep_legal_numero_doc: get("rep_legal_numero_doc"),
    rep_legal_cargo: get("rep_legal_cargo") ?? "Representante Legal",
    contador_nombre: get("contador_nombre"),
    contador_tipo_doc: get("contador_tipo_doc") ?? "CC",
    contador_numero_doc: get("contador_numero_doc"),
    contador_tarjeta_prof: get("contador_tarjeta_prof"),
    obligado_revisor_fiscal: getBool("obligado_revisor_fiscal"),
    rf_nombre: get("rf_nombre"),
    rf_tipo_doc: get("rf_tipo_doc") ?? "CC",
    rf_numero_doc: get("rf_numero_doc"),
    rf_tarjeta_prof: get("rf_tarjeta_prof"),
    marco_normativo: get("marco_normativo") ?? "NIIF Pymes",
    direccion_notificacion: get("direccion_notificacion"),
    departamento_codigo: get("departamento_codigo"),
    municipio_codigo: get("municipio_codigo"),
    telefono: get("telefono"),
    correo: get("correo"),
    observaciones: get("observaciones"),
  };

  const { error } = await supabase
    .from("formato_2516_h1_caratula")
    .upsert(payload, { onConflict: "declaracion_id" });
  if (error) return { ok: false, error: error.message };

  revalidateDeclaracion(empresaId, declId);
  return { ok: true, error: null };
}
