"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateDeclaracion } from "@/lib/revalidate";

export type ConfigState = { error: string | null; saved: boolean };

const NUMERIC_FIELDS = new Set([
  "saldo_pagar_anterior",
  "saldo_favor_anterior",
  "anticipo_para_actual",
  "anticipo_puntos_adicionales",
  "patrimonio_bruto_anterior",
  "pasivos_anterior",
  "perdidas_fiscales_acumuladas",
  "utilidad_contable",
  "perdida_contable",
  "total_nomina",
  "aportes_seg_social",
  "aportes_para_fiscales",
  "impuesto_neto_anterior",
  "mayor_valor_correccion", // Base para sanción por corrección (Art. 644 E.T.)
]);

const BOOL_FIELDS = new Set([
  "es_gran_contribuyente",
  "tiene_justificacion_patrimonial",
  "calcula_anticipo",
  "es_institucion_financiera",
  "aplica_tasa_minima",
  "ica_como_descuento",
  "beneficio_auditoria_12m",
  "beneficio_auditoria_6m",
  "calcula_sancion_extemporaneidad",
  "calcula_sancion_correccion",
  "existe_emplazamiento",
  // Datos de presentación (Formulario 110, casillas 29, 30, 31, 994)
  "fraccion_ano_siguiente",
  "renuncio_regimen_especial",
  "vinculado_obras_impuestos",
  "con_salvedades",
]);

const TEXT_FIELDS = new Set(["reduccion_sancion", "anios_declarando"]);

// Texto libre que admite vaciar (null cuando viene vacío). Distinto a TEXT_FIELDS
// que sólo aceptan valores predefinidos y por seguridad ignoran string vacío.
const NULLABLE_TEXT_FIELDS = new Set([
  "numero_formulario_anterior", // R26
  "cod_representacion",         // R981
  "cod_contador_rf",            // R982
  "tarjeta_profesional",        // R983
]);

const DATE_FIELDS = new Set(["fecha_vencimiento", "fecha_presentacion"]);

function parseNumeric(s: string): number {
  const cleaned = s.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function saveConfiguracionAction(
  declId: string,
  empresaId: string,
  _prev: ConfigState,
  form: FormData,
): Promise<ConfigState> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const [key, raw] of form.entries()) {
    const v = String(raw ?? "");
    if (NUMERIC_FIELDS.has(key)) {
      update[key] = parseNumeric(v);
    } else if (BOOL_FIELDS.has(key)) {
      update[key] = v === "on" || v === "true" || v === "1";
    } else if (TEXT_FIELDS.has(key)) {
      if (v) update[key] = v;
    } else if (NULLABLE_TEXT_FIELDS.has(key)) {
      update[key] = v.trim() || null;
    } else if (DATE_FIELDS.has(key)) {
      update[key] = v || null;
    } else if (key !== "$ACTION_REF_1" && !key.startsWith("$ACTION_")) {
      // Safety net: cualquier campo del form que no esté en ningún set queda
      // SIN GUARDAR. Logueamos para detectar regresiones tipo
      // mayor_valor_correccion (que tardó meses en aparecer).
      // Excluimos los `$ACTION_*` que Next.js inyecta en server actions.
      console.warn(
        `[saveConfiguracionAction] Campo no manejado en ningún FIELDS set: "${key}". Agrégalo a NUMERIC/BOOL/TEXT/NULLABLE_TEXT/DATE.`,
      );
    }
  }

  // Booleanos no enviados (checkbox desmarcado) deben quedar en false.
  for (const f of BOOL_FIELDS) {
    if (!(f in update)) update[f] = false;
  }

  const { error } = await supabase
    .from("declaraciones")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(update as any)
    .eq("id", declId);
  if (error) return { error: error.message, saved: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, saved: true };
}
