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
  const getNum = (k: string) => {
    const v = formData.get(k);
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const payload = {
    declaracion_id: declId,
    // Representantes
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
    // Tarifa
    tarifa_aplicable: getNum("tarifa_aplicable"),
    art_aplicable: get("art_aplicable"),
    // Flags DIAN (22 campos · MUISCA 30-51)
    pn_sin_residencia: getBool("pn_sin_residencia"),
    rte: getBool("rte"),
    entidad_cooperativa: getBool("entidad_cooperativa"),
    entidad_sector_financiero: getBool("entidad_sector_financiero"),
    nueva_sociedad_zomac: getBool("nueva_sociedad_zomac"),
    obras_por_impuestos_zomac: getBool("obras_por_impuestos_zomac"),
    reorganizacion_empresarial: getBool("reorganizacion_empresarial"),
    soc_extranjera_transporte: getBool("soc_extranjera_transporte"),
    sist_especial_valoracion: getBool("sist_especial_valoracion"),
    costo_inv_juego_inv: getBool("costo_inv_juego_inv"),
    costo_inv_simultaneo: getBool("costo_inv_simultaneo"),
    progresividad_tarifa: getBool("progresividad_tarifa"),
    contrato_estabilidad: getBool("contrato_estabilidad"),
    moneda_funcional_diferente: getBool("moneda_funcional_diferente"),
    mega_inversiones: getBool("mega_inversiones"),
    economia_naranja: getBool("economia_naranja"),
    holding_colombiana: getBool("holding_colombiana"),
    zese: getBool("zese"),
    extraccion_hulla_carbon: getBool("extraccion_hulla_carbon"),
    extraccion_petroleo: getBool("extraccion_petroleo"),
    generacion_energia_hidro: getBool("generacion_energia_hidro"),
    zona_franca: getBool("zona_franca"),
    // Signatario
    signatario_nit: get("signatario_nit"),
    signatario_dv: get("signatario_dv"),
    codigo_representacion: get("codigo_representacion"),
    codigo_contador_rf: get("codigo_contador_rf"),
    numero_tarjeta_profesional: get("numero_tarjeta_profesional"),
    con_salvedades: getBool("con_salvedades"),
    fecha_efectiva_transaccion: get("fecha_efectiva_transaccion"),
  };

  const { error } = await supabase
    .from("formato_2516_h1_caratula")
    .upsert(payload, { onConflict: "declaracion_id" });
  if (error) return { ok: false, error: error.message };

  revalidateDeclaracion(empresaId, declId);
  return { ok: true, error: null };
}
