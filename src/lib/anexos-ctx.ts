// Cargador único de TODOS los totales de anexos para alimentar el
// `ComputeContext` del engine. Centraliza en un único punto los cruces
// entre anexos y renglones del Formulario 110, eliminando la duplicación
// previa entre formulario-110, imprimir, validaciones, conciliación
// patrimonial y la página padre del editor.
//
// MAPA DE CRUCES (anexo → renglón):
//   anexo_dividendos                     → R49..R56  (categorías)
//   anexo_incrngo                        → R60       (Anexo 26)
//   anexo_recuperaciones                 → R70       (Anexo 17)
//   anexo_compensaciones                 → R74       (Anexo 20, lim. R72)
//   anexo_rentas_exentas                 → R77       (Anexo 19)
//   anexo_ganancia_ocasional             → R80/R81/R82 (Anexo 8)
//   anexo_venta_activos_fijos (>2 años)  → R80/R81   (suma a Anexo 8)
//   anexo_descuentos                     → R93       (Anexo 4, lim. 75% R84)
//   anexo_iva_capital                    → R93       (Art. 258-1, suma a R93)
//   anexo_retenciones                    → R105/R106 (Anexo 3)
//   anexo_seg_social                     → R33/R34/R35
//
// Anexos informativos (no afectan el F110, alimentan F2516 / análisis):
//   anexo_dividendos_distribuir, anexo_predial, anexo_gmf, anexo_ica,
//   anexo_intereses_presuntivos, anexo_diferencia_cambio,
//   anexo_deterioro_cartera, anexo_subcapitalizacion
//   (estos alimentan /conciliacion-fiscal como partidas automáticas)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { loadSegSocialTotals } from "./seg-social-totals";

type DeclMin = {
  empresa_id?: string | null;
  total_nomina: number | string | null;
  aportes_seg_social: number | string | null;
  aportes_para_fiscales: number | string | null;
  ano_gravable?: number | null;
};

// Régimenes Tributarios Especiales (Art. 19 + Art. 356-364 E.T.) · sus
// rentas exentas (excedentes Art. 358) NO están sujetas al tope del 10%
// que aplica solo a las rentas exentas Art. 235-2 par. 5 del régimen
// ordinario. Códigos del catálogo DIAN.
const REGIMENES_RTE = new Set(["02", "03", "08", "09", "12", "16", "20"]);

export type AnexosCtx = {
  totalNomina: number;
  aportesSegSocial: number;
  aportesParaFiscales: number;
  totalAutorretenciones: number;
  totalRetenciones: number;
  totalDescuentosTributarios: number;
  goIngresos: number;
  goCostos: number;
  goNoGravada: number;
  totalRentasExentas: number;
  /** Subset de rentas exentas sujeto al tope del 10% RL (Art. 235-2 par. 5). */
  totalRentasExentasConTope: number;
  totalCompensaciones: number;
  /** Detalle de compensaciones con año de origen para validar plazo Art. 147. */
  compensacionesConAno: { ano_origen: number; compensar: number }[];
  /** Año gravable de la declaración (para Art. 147 plazo de 12 años). */
  anoGravable?: number;
  totalRecuperaciones: number;
  totalIncrngo: number;
  totalInversionesEsalEfectuadas: number;
  totalInversionesEsalLiquidadas: number;
  dividendos: {
    r49: number;
    r50: number;
    r51: number;
    r52: number;
    r53: number;
    r54: number;
    r55: number;
    r56: number;
  };
  /** Tipo de actividad para la sobretasa Art. 240. */
  tipoSobretasa: "ninguna" | "financiera" | "hidroelectrica" | "extractora";
  /** Para extractoras Art. 240 par. 2 · puntos según precio del año. */
  puntosSobretasaExtractora: number;
};

/**
 * Carga en paralelo todos los totales de anexos relevantes para el F110
 * y devuelve un objeto listo para hacer spread sobre el ctx del engine.
 *
 * Las consultas son disjuntas (cada una a una tabla distinta) y por tanto
 * idempotentes en concurrencia. Promise.all las paraleliza.
 */
export async function loadAnexosCtx(
  supabase: SupabaseClient<Database>,
  declId: string,
  declaracion: DeclMin,
): Promise<AnexosCtx> {
  const [
    { data: retenciones },
    { data: descuentos },
    { data: ivaCapital },
    { data: gos },
    { data: ventaAf },
    { data: rentasExentas },
    { data: compensaciones },
    { data: recups },
    { data: incrngos },
    { data: divs },
    invEsalRes,
    segSocial,
  ] = await Promise.all([
    supabase.from("anexo_retenciones").select("tipo, retenido").eq("declaracion_id", declId),
    supabase.from("anexo_descuentos").select("valor_descuento").eq("declaracion_id", declId),
    supabase.from("anexo_iva_capital").select("iva_pagado").eq("declaracion_id", declId),
    supabase
      .from("anexo_ganancia_ocasional")
      .select("precio_venta, costo_fiscal, no_gravada")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_venta_activos_fijos")
      .select(
        "posesion_mas_2_anos, precio_venta, costo_fiscal, depreciacion_acumulada, reajustes_fiscales",
      )
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_rentas_exentas")
      .select("valor_fiscal, normatividad, sujeto_tope_10pct")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_compensaciones")
      .select("compensar, ano_origen")
      .eq("declaracion_id", declId),
    supabase.from("anexo_recuperaciones").select("valor").eq("declaracion_id", declId),
    supabase.from("anexo_incrngo").select("valor").eq("declaracion_id", declId),
    supabase
      .from("anexo_dividendos")
      .select(
        "no_constitutivos, distribuidos_no_residentes, gravados_tarifa_general, gravados_persona_natural_dos, gravados_personas_extranjeras, gravados_art_245, gravados_tarifa_l1819, gravados_proyectos",
      )
      .eq("declaracion_id", declId),
    // Anexo Inversiones ESAL · puede no existir si la migración 027 no
    // está aplicada. Tratamos el error como tabla vacía.
    supabase
      .from("anexo_inversiones_esal")
      .select("tipo, valor")
      .eq("declaracion_id", declId),
    loadSegSocialTotals(supabase, declId, declaracion),
  ]);

  const invEsalRows = invEsalRes.error ? [] : (invEsalRes.data ?? []);
  const totalInversionesEsalEfectuadas = invEsalRows
    .filter((r) => r.tipo === "efectuada")
    .reduce((s, r) => s + Number(r.valor), 0);
  const totalInversionesEsalLiquidadas = invEsalRows
    .filter((r) => r.tipo === "liquidada")
    .reduce((s, r) => s + Number(r.valor), 0);

  // R105/R106 · Retenciones / Autorretenciones
  const totalAutorretenciones = (retenciones ?? [])
    .filter((r) => r.tipo === "autorretencion")
    .reduce((s, r) => s + Number(r.retenido), 0);
  const totalRetenciones = (retenciones ?? [])
    .filter((r) => r.tipo === "retencion")
    .reduce((s, r) => s + Number(r.retenido), 0);

  // R93 · Descuentos tributarios + IVA bienes capital (Art. 258-1)
  const totalDescuentos = (descuentos ?? []).reduce(
    (s, d) => s + Number(d.valor_descuento),
    0,
  );
  const totalIvaCapital = (ivaCapital ?? []).reduce(
    (s, i) => s + Number(i.iva_pagado),
    0,
  );
  const totalDescuentosTributarios = totalDescuentos + totalIvaCapital;

  // R80/R81/R82 · Ganancia ocasional (Anexo 8 + venta de AF >2a)
  const goAnexo = {
    ingresos: (gos ?? []).reduce((s, g) => s + Number(g.precio_venta), 0),
    costos: (gos ?? []).reduce((s, g) => s + Number(g.costo_fiscal), 0),
    noGravada: (gos ?? []).reduce((s, g) => s + Number(g.no_gravada), 0),
  };
  const ventaAfMas2 = (ventaAf ?? []).filter((v) => v.posesion_mas_2_anos);
  const ventaAfIngresos = ventaAfMas2.reduce((s, v) => s + Number(v.precio_venta), 0);
  const ventaAfCostos = ventaAfMas2.reduce(
    (s, v) =>
      s +
      Math.max(
        0,
        Number(v.costo_fiscal) -
          Number(v.depreciacion_acumulada) +
          Number(v.reajustes_fiscales),
      ),
    0,
  );

  const dividendos = {
    r49: (divs ?? []).reduce((s, d) => s + Number(d.no_constitutivos), 0),
    r50: (divs ?? []).reduce((s, d) => s + Number(d.distribuidos_no_residentes), 0),
    r51: (divs ?? []).reduce((s, d) => s + Number(d.gravados_tarifa_general), 0),
    r52: (divs ?? []).reduce((s, d) => s + Number(d.gravados_persona_natural_dos), 0),
    r53: (divs ?? []).reduce((s, d) => s + Number(d.gravados_personas_extranjeras), 0),
    r54: (divs ?? []).reduce((s, d) => s + Number(d.gravados_art_245), 0),
    r55: (divs ?? []).reduce((s, d) => s + Number(d.gravados_tarifa_l1819), 0),
    r56: (divs ?? []).reduce((s, d) => s + Number(d.gravados_proyectos), 0),
  };

  // Rentas exentas: separa las sujetas al tope del 10% RL (Art. 235-2 par. 5).
  // Prioridad:
  //   0. Régimen RTE/ESAL (Art. 19, 356-364) → NUNCA tope · Art. 358 excedente
  //      reinvertido es exento puro
  //   1. Si el registro tiene `sujeto_tope_10pct` explícito (post-migración 031), úsalo
  //   2. Sino, heurística por `normatividad`: numerales 1-6 del Art. 235-2 sí
  //      tienen tope; numerales 7 (energías) y 8 (editorial) y convenios CAN/DTI no.
  let regimenCodigo: string | null = null;
  if (declaracion.empresa_id) {
    const { data: emp } = await supabase
      .from("empresas")
      .select("regimen_codigo")
      .eq("id", declaracion.empresa_id)
      .maybeSingle();
    regimenCodigo = emp?.regimen_codigo ?? null;
  }
  const esRTE = regimenCodigo != null && REGIMENES_RTE.has(regimenCodigo);

  const sinTopeRegex = /art\.?\s*235-2.*num.*[78]|can|decisi[oó]n\s*578|conv\./i;
  let totalRentasExentasSinTope = 0;
  let totalRentasExentasConTope = 0;
  for (const r of rentasExentas ?? []) {
    const v = Number(r.valor_fiscal);
    const norm = String(r.normatividad ?? "");
    // RTE/ESAL → siempre sin tope. Régimen ordinario → flag explícito o
    // heurística. Default conservador en ordinario: aplicar tope.
    const sujetoTope = esRTE
      ? false
      : (r.sujeto_tope_10pct ?? !sinTopeRegex.test(norm));
    if (sujetoTope) totalRentasExentasConTope += v;
    else totalRentasExentasSinTope += v;
  }

  // Compensaciones con año de origen para validar plazo Art. 147 (12 años).
  const compensacionesConAno = (compensaciones ?? []).map((c) => ({
    ano_origen: Number(c.ano_origen) || 0,
    compensar: Number(c.compensar) || 0,
  }));

  // Sobretasa Art. 240 según el campo `tipo_sobretasa` de la declaración
  // (migración 031). Compat: `es_institucion_financiera = true` mapea a
  // 'financiera' cuando `tipo_sobretasa` es 'ninguna'.
  type DeclSobretasa = {
    tipo_sobretasa?: string | null;
    puntos_sobretasa_extractora?: number | string | null;
    es_institucion_financiera?: boolean | null;
  };
  const dec = declaracion as DeclMin & DeclSobretasa;
  const tipoRaw = (dec.tipo_sobretasa ?? "ninguna") as string;
  const tiposValidos = ["ninguna", "financiera", "hidroelectrica", "extractora"] as const;
  type SobretasaT = (typeof tiposValidos)[number];
  let tipoSobretasa: SobretasaT = (tiposValidos as readonly string[]).includes(tipoRaw)
    ? (tipoRaw as SobretasaT)
    : "ninguna";
  if (tipoSobretasa === "ninguna" && dec.es_institucion_financiera) {
    tipoSobretasa = "financiera";
  }

  return {
    totalNomina: segSocial.totalNomina,
    aportesSegSocial: segSocial.aportesSegSocial,
    aportesParaFiscales: segSocial.aportesParaFiscales,
    totalAutorretenciones,
    totalRetenciones,
    totalDescuentosTributarios,
    goIngresos: goAnexo.ingresos + ventaAfIngresos,
    goCostos: goAnexo.costos + ventaAfCostos,
    goNoGravada: goAnexo.noGravada,
    // Total fallback (mantiene compat) + desglose para tope 10% RL
    totalRentasExentas: totalRentasExentasSinTope,
    totalRentasExentasConTope,
    // Total fallback + desglose con año para validar plazo 12 años
    totalCompensaciones: compensacionesConAno.reduce(
      (s, c) => s + c.compensar,
      0,
    ),
    compensacionesConAno,
    anoGravable: Number(declaracion.ano_gravable) || undefined,
    totalRecuperaciones: (recups ?? []).reduce((s, r) => s + Number(r.valor), 0),
    totalIncrngo: (incrngos ?? []).reduce((s, i) => s + Number(i.valor), 0),
    totalInversionesEsalEfectuadas,
    totalInversionesEsalLiquidadas,
    dividendos,
    tipoSobretasa,
    puntosSobretasaExtractora: Number(dec.puntos_sobretasa_extractora ?? 0),
  };
}
