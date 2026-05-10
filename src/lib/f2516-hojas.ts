// Cargadores Supabase para las 7 hojas del F2516.
//
// Cada loader lee la captura de la BD para una declaración y la combina
// con su catálogo (que vive en src/engine/f2516-hN.ts) y los datos
// derivados (balance, F110) para producir la vista calculada.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  F2516_H4_CATEGORIAS,
  computarH4,
  type F2516H4Captura,
  type F2516H4Resumen,
} from "@/engine/f2516-h4";
import {
  F2516_H5_CONCEPTOS,
  computarH5,
  type F2516H5Captura,
  type F2516H5Conciliacion,
  type F2516H5Resumen,
} from "@/engine/f2516-h5";
import {
  F2516_H6_CATEGORIAS,
  computarH6,
  type F2516H6Captura,
  type F2516H6Resumen,
} from "@/engine/f2516-h6";

type SC = SupabaseClient<Database>;

// ---------- H1 Carátula ----------
export type F2516H1Caratula = {
  declaracion_id: string;
  rep_legal_nombre: string | null;
  rep_legal_tipo_doc: string | null;
  rep_legal_numero_doc: string | null;
  rep_legal_cargo: string | null;
  contador_nombre: string | null;
  contador_tipo_doc: string | null;
  contador_numero_doc: string | null;
  contador_tarjeta_prof: string | null;
  obligado_revisor_fiscal: boolean;
  rf_nombre: string | null;
  rf_tipo_doc: string | null;
  rf_numero_doc: string | null;
  rf_tarjeta_prof: string | null;
  marco_normativo: string | null;
  direccion_notificacion: string | null;
  departamento_codigo: string | null;
  municipio_codigo: string | null;
  telefono: string | null;
  correo: string | null;
  observaciones: string | null;
};

export async function loadF2516H1(
  supabase: SC,
  declId: string,
): Promise<F2516H1Caratula | null> {
  const { data } = await supabase
    .from("formato_2516_h1_caratula")
    .select("*")
    .eq("declaracion_id", declId)
    .maybeSingle();
  return (data as F2516H1Caratula | null) ?? null;
}

// ---------- H4 Impuesto Diferido ----------
export async function loadF2516H4(
  supabase: SC,
  declId: string,
): Promise<F2516H4Resumen> {
  const { data } = await supabase
    .from("formato_2516_h4_imp_diferido")
    .select("*")
    .eq("declaracion_id", declId);
  const capturas = (data ?? []).map((d) => ({
    declaracion_id: d.declaracion_id as string,
    categoria_id: d.categoria_id as string,
    tipo: d.tipo as "atd" | "ptd",
    base_contable: Number(d.base_contable),
    base_fiscal: Number(d.base_fiscal),
    tarifa: Number(d.tarifa),
    observacion: (d.observacion as string | null) ?? null,
  })) as F2516H4Captura[];
  return computarH4(capturas);
}

// ---------- H5 Ingresos y Facturación ----------
export async function loadF2516H5(
  supabase: SC,
  declId: string,
): Promise<F2516H5Resumen> {
  const [{ data: ingresos }, { data: conciliacion }] = await Promise.all([
    supabase
      .from("formato_2516_h5_ingresos")
      .select("*")
      .eq("declaracion_id", declId),
    supabase
      .from("formato_2516_h5_conciliacion")
      .select("*")
      .eq("declaracion_id", declId)
      .maybeSingle(),
  ]);
  const capturas = (ingresos ?? []).map((d) => ({
    declaracion_id: d.declaracion_id as string,
    concepto_id: d.concepto_id as string,
    concepto: d.concepto as string,
    gravados: Number(d.gravados),
    exentos: Number(d.exentos),
    excluidos: Number(d.excluidos),
    exportacion: Number(d.exportacion),
    observacion: (d.observacion as string | null) ?? null,
  })) as F2516H5Captura[];
  const conc = conciliacion
    ? ({
        declaracion_id: conciliacion.declaracion_id as string,
        total_facturado_dian: Number(conciliacion.total_facturado_dian),
        notas_credito_emitidas: Number(conciliacion.notas_credito_emitidas),
        notas_debito_emitidas: Number(conciliacion.notas_debito_emitidas),
        observacion: (conciliacion.observacion as string | null) ?? null,
      } as F2516H5Conciliacion)
    : null;
  return computarH5(capturas, conc);
}

// ---------- H6 Activos Fijos ----------
export async function loadF2516H6(
  supabase: SC,
  declId: string,
): Promise<F2516H6Resumen> {
  const { data } = await supabase
    .from("formato_2516_h6_activos_fijos")
    .select("*")
    .eq("declaracion_id", declId);
  const capturas = (data ?? []).map((d) => ({
    declaracion_id: d.declaracion_id as string,
    categoria_id: d.categoria_id as string,
    categoria: d.categoria as string,
    saldo_inicial: Number(d.saldo_inicial),
    adiciones: Number(d.adiciones),
    retiros: Number(d.retiros),
    deprec_acumulada: Number(d.deprec_acumulada),
    deprec_ano: Number(d.deprec_ano),
    ajuste_fiscal: Number(d.ajuste_fiscal),
    observacion: (d.observacion as string | null) ?? null,
  })) as F2516H6Captura[];
  return computarH6(capturas);
}

// Re-exports para conveniencia desde las páginas
export { F2516_H4_CATEGORIAS, F2516_H5_CONCEPTOS, F2516_H6_CATEGORIAS };
