// Cargador Supabase de la Conciliación de Utilidades.
//
// Lee:
//   - utilidad contable de `declaraciones`
//   - SUMIFs por prefijo PUC sobre balance de prueba (lado contable PyG)
//   - anexos: ICA, INCRNGO, recuperaciones, donaciones, GMF, intereses
//     presuntivos, diferencia en cambio
//   - flags de la declaración: ica_como_descuento, sub_es_vinculado, dc_*
//   - partidas manuales de `conciliacion_partidas` (clasificadas por
//     categoria NIC 12: temporaria_deducible | temporaria_imponible | permanente)
//
// Devuelve el objeto listo para `computarConcUtilidades`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  type CategoriaConc,
  type ConcUtilidadesInput,
  type PartidaConc,
} from "@/engine/conc-utilidades";

type SC = SupabaseClient<Database>;

type DeclMin = {
  id: string;
  utilidad_contable?: number | string | null;
  perdida_contable?: number | string | null;
  ica_como_descuento?: boolean | null;
  sub_es_vinculado?: boolean | null;
  sub_deuda_promedio?: number | string | null;
  sub_intereses?: number | string | null;
  patrimonio_bruto_anterior?: number | string | null;
  pasivos_anterior?: number | string | null;
  dc_metodo?: string | null;
  dc_cartera_0_90?: number | string | null;
  dc_cartera_91_180?: number | string | null;
  dc_cartera_181_360?: number | string | null;
  dc_cartera_360_mas?: number | string | null;
  dc_saldo_contable?: number | string | null;
  trm_final?: number | string | null;
  tasa_interes_presuntivo?: number | string | null;
};

const num = (v: number | string | null | undefined): number =>
  v == null ? 0 : Number(v);

/**
 * Calcula los saldos contables por prefijo PUC desde el balance de prueba.
 * Replica los `SUMIF` de la hoja Conc Utilidades del .xlsm guía.
 */
async function calcularContablesPyG(supabase: SC, declId: string) {
  const { data: lineas } = await supabase
    .from("balance_prueba_lineas")
    .select("cuenta, saldo, balance_id, balance_pruebas!inner(declaracion_id)")
    .eq("balance_pruebas.declaracion_id", declId);

  const sumByPrefix = (prefix: string): number => {
    return (lineas ?? [])
      .filter((l) => String(l.cuenta).startsWith(prefix))
      .reduce((s, l) => s + Math.abs(Number(l.saldo)), 0);
  };

  return {
    ingOperacionales41: sumByPrefix("41"),
    ingNoOperacionales42: sumByPrefix("42"),
    devoluciones4175: sumByPrefix("4175"),
    costoVenta6: sumByPrefix("6"),
    gastosAdmin51: sumByPrefix("51"),
    gastosVentas52: sumByPrefix("52"),
    gastosNoOper53: sumByPrefix("53"),
    gastosOtros54: sumByPrefix("54"),
  };
}

/**
 * Extrae las partidas automáticas que la app puede derivar sin captura
 * adicional del usuario. Cada partida lleva su categoría NIC 12 ya
 * asignada según la naturaleza tributaria del concepto.
 */
async function calcularPartidasAuto(
  supabase: SC,
  declaracion: DeclMin,
): Promise<PartidaConc[]> {
  const declId = declaracion.id;
  const partidas: PartidaConc[] = [];

  const [icaRes, incRes, recRes, donRes, gmfRes, ipRes, dcRes] = await Promise.all([
    supabase.from("anexo_ica").select("valor_pagado").eq("declaracion_id", declId),
    supabase.from("anexo_incrngo").select("valor").eq("declaracion_id", declId),
    supabase.from("anexo_recuperaciones").select("valor").eq("declaracion_id", declId),
    supabase
      .from("anexo_descuentos")
      .select("valor_descuento, categoria")
      .eq("declaracion_id", declId),
    supabase.from("anexo_gmf").select("valor_gmf").eq("declaracion_id", declId),
    supabase
      .from("anexo_intereses_presuntivos")
      .select("saldo_promedio, dias, interes_registrado")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_diferencia_cambio")
      .select("valor_usd, trm_inicial, tipo")
      .eq("declaracion_id", declId),
  ]);

  // 1. ICA 50% no deducible · permanente · suma (Art. 115 E.T.)
  const totalIca = (icaRes.data ?? []).reduce(
    (s, r) => s + Number(r.valor_pagado),
    0,
  );
  if (totalIca > 0 && declaracion.ica_como_descuento) {
    partidas.push({
      id: "auto-ica-50",
      origen: "auto",
      categoria: "permanente",
      signo: "mas",
      concepto: "50% ICA pagado (tomado como descuento tributario)",
      valor: totalIca * 0.5,
      fuente: "Anexo ICA",
      observacion: "Art. 115 E.T.: solo el 50% es deducible cuando se toma como descuento.",
    });
  }

  // 2. INCRNGO · permanente · resta (no es renta gravable)
  const totalIncrngo = (incRes.data ?? []).reduce((s, r) => s + Number(r.valor), 0);
  if (totalIncrngo > 0) {
    partidas.push({
      id: "auto-incrngo",
      origen: "auto",
      categoria: "permanente",
      signo: "menos",
      concepto: "Ingresos no constitutivos de renta ni GO (R60)",
      valor: totalIncrngo,
      fuente: "Anexo INCRNGO",
      observacion: "Arts. 36-57-2 E.T. · ingresos contables que la ley excluye.",
    });
  }

  // 3. Recuperación de deducciones · permanente · suma (Art. 195 E.T.)
  const totalRecup = (recRes.data ?? []).reduce((s, r) => s + Number(r.valor), 0);
  if (totalRecup > 0) {
    partidas.push({
      id: "auto-recup",
      origen: "auto",
      categoria: "permanente",
      signo: "mas",
      concepto: "Renta líquida por recuperación de deducciones (R70)",
      valor: totalRecup,
      fuente: "Anexo Recuperaciones",
      observacion: "Art. 195 E.T. · suma a la renta fiscal.",
    });
  }

  // 4. Donaciones × 4 · permanente · suma (Art. 257 E.T.)
  const totalDonaciones = (donRes.data ?? [])
    .filter((d) => /donaci/i.test(String(d.categoria)))
    .reduce((s, d) => s + Number(d.valor_descuento), 0);
  if (totalDonaciones > 0) {
    partidas.push({
      id: "auto-donaciones",
      origen: "auto",
      categoria: "permanente",
      signo: "mas",
      concepto: "Donaciones tomadas como descuento (no deducibles como gasto)",
      valor: totalDonaciones * 4, // descuento 25% → gasto base ~4x
      fuente: "Anexo Descuentos",
      observacion: "Art. 257 E.T. · si se toma 25% como descuento, no se deduce como gasto.",
    });
  }

  // 5. GMF 50% no deducible · permanente · suma (Art. 115 E.T.)
  const totalGmf = (gmfRes.data ?? []).reduce(
    (s, r) => s + Number(r.valor_gmf),
    0,
  );
  if (totalGmf > 0) {
    partidas.push({
      id: "auto-gmf-50",
      origen: "auto",
      categoria: "permanente",
      signo: "mas",
      concepto: "50% GMF no deducible",
      valor: totalGmf * 0.5,
      fuente: "Anexo GMF",
      observacion: "Art. 115 E.T. · solo 50% del GMF es deducible.",
    });
  }

  // 6. Deterioro de cartera · TEMPORARIA · suma o resta según signo
  const dcMetodo = (declaracion.dc_metodo ?? "general") as
    | "general"
    | "individual"
    | "combinado";
  const dc0 = num(declaracion.dc_cartera_0_90);
  const dc1 = num(declaracion.dc_cartera_91_180);
  const dc2 = num(declaracion.dc_cartera_181_360);
  const dc3 = num(declaracion.dc_cartera_360_mas);
  const dcSaldoCont = num(declaracion.dc_saldo_contable);
  const provGen = dc0 * 0 + dc1 * 0.05 + dc2 * 0.1 + dc3 * 0.15;
  const provInd = dc3 * 0.33;
  const provCombo = Math.max(provGen, provInd);
  const provFiscal =
    dcMetodo === "general" ? provGen : dcMetodo === "individual" ? provInd : provCombo;
  const ajusteDc = provFiscal - dcSaldoCont;
  if (Math.abs(ajusteDc) > 0.01) {
    // Si la fiscal > contable, se acepta más deterioro fiscalmente → resta a la
    // utilidad fiscal (deducción adicional) → temporaria deducible con signo "menos".
    // Si fiscal < contable, el deterioro contable no fue todo deducible → suma
    // (vuelve a la utilidad fiscal el exceso) → temporaria deducible con "mas".
    partidas.push({
      id: "auto-deterioro",
      origen: "auto",
      categoria: "temporaria_deducible",
      signo: ajusteDc > 0 ? "menos" : "mas",
      concepto:
        ajusteDc > 0
          ? "Mayor provisión fiscal cartera vs contable"
          : "Menor provisión fiscal cartera vs contable (reverso)",
      valor: Math.abs(ajusteDc),
      fuente: "Deterioro Cartera",
      observacion: `Método ${dcMetodo} · Art. 145 E.T. Provisión fiscal $${Math.round(provFiscal).toLocaleString()} vs contable $${Math.round(dcSaldoCont).toLocaleString()}.`,
    });
  }

  // 7. Interés presuntivo socios · permanente · suma (Art. 35 E.T.)
  const tasaIp = num(declaracion.tasa_interes_presuntivo);
  const totalIp = (ipRes.data ?? []).reduce((s, p) => {
    const presunto = Number(p.saldo_promedio) * tasaIp * (Number(p.dias) / 360);
    return s + Math.max(0, presunto - Number(p.interes_registrado));
  }, 0);
  if (totalIp > 0) {
    partidas.push({
      id: "auto-int-presuntivo",
      origen: "auto",
      categoria: "permanente",
      signo: "mas",
      concepto: "Interés presuntivo a socios (Art. 35 E.T.)",
      valor: totalIp,
      fuente: "Anexo Intereses Presuntivos",
    });
  }

  // 8. Subcapitalización · permanente · suma (Art. 118-1 E.T.)
  if (declaracion.sub_es_vinculado) {
    const deuda = num(declaracion.sub_deuda_promedio);
    const intereses = num(declaracion.sub_intereses);
    const plAnt =
      num(declaracion.patrimonio_bruto_anterior) - num(declaracion.pasivos_anterior);
    const limite = plAnt * 2;
    const exceso = Math.max(0, deuda - limite);
    const propExc = deuda > 0 ? exceso / deuda : 0;
    const intNoDed = intereses * propExc;
    if (intNoDed > 0.01) {
      partidas.push({
        id: "auto-subcap",
        origen: "auto",
        categoria: "permanente",
        signo: "mas",
        concepto: "Intereses no deducibles por subcapitalización (Art. 118-1)",
        valor: intNoDed,
        fuente: "Subcapitalización",
        observacion: `Exceso $${Math.round(exceso).toLocaleString()} / deuda $${Math.round(deuda).toLocaleString()} (${(propExc * 100).toFixed(2)}%).`,
      });
    }
  }

  // 9. Diferencia en cambio · TEMPORARIA · signo según efecto neto
  const trmFinal = num(declaracion.trm_final);
  const totalDifCambio = (dcRes.data ?? []).reduce((s, d) => {
    const valIni = Number(d.valor_usd) * Number(d.trm_inicial);
    const valFin = Number(d.valor_usd) * trmFinal;
    const dif = valFin - valIni;
    return s + (d.tipo === "pasivo" ? -dif : dif);
  }, 0);
  if (Math.abs(totalDifCambio) > 0.01) {
    // Causación fiscal por TRM final · genera diferencia temporaria
    // imponible (si suma a la renta) o deducible (si resta).
    partidas.push({
      id: "auto-dif-cambio",
      origen: "auto",
      categoria:
        totalDifCambio > 0 ? "temporaria_imponible" : "temporaria_deducible",
      signo: totalDifCambio > 0 ? "mas" : "menos",
      concepto:
        totalDifCambio > 0
          ? "Diferencia en cambio · ingreso fiscal"
          : "Diferencia en cambio · gasto fiscal",
      valor: Math.abs(totalDifCambio),
      fuente: "Anexo Diferencia en Cambio",
      observacion: "Causación fiscal por TRM final · Art. 285 E.T.",
    });
  }

  return partidas;
}

/**
 * Carga las partidas manuales clasificándolas en las 3 categorías NIC 12
 * según el campo `tipo` (legacy: permanente | temporal). Si el legacy está
 * en "temporal" lo asignamos a temporaria_deducible o imponible según signo.
 */
async function calcularPartidasManuales(
  supabase: SC,
  declId: string,
): Promise<PartidaConc[]> {
  const { data } = await supabase
    .from("conciliacion_partidas")
    .select("id, tipo, signo, concepto, valor, observacion, categoria_nic12")
    .eq("declaracion_id", declId);

  return (data ?? []).map((p) => {
    // Si la migración 032 ya asignó categoria_nic12 explícita, úsala.
    let categoria: CategoriaConc;
    const cat = (p as unknown as { categoria_nic12?: string }).categoria_nic12;
    if (cat === "temporaria_deducible" || cat === "temporaria_imponible" || cat === "permanente") {
      categoria = cat;
    } else if (p.tipo === "permanente") {
      categoria = "permanente";
    } else {
      // Legacy "temporal" sin categoría · clasifica por signo
      categoria = p.signo === "mas" ? "temporaria_deducible" : "temporaria_imponible";
    }
    return {
      id: `manual-${p.id}`,
      origen: "manual" as const,
      categoria,
      signo: p.signo as "mas" | "menos",
      concepto: p.concepto,
      valor: Number(p.valor),
      observacion: p.observacion ?? null,
    };
  });
}

/**
 * Loader principal · ensambla los inputs para el engine.
 */
export async function loadConcUtilidades(
  supabase: SC,
  declaracion: DeclMin,
  valoresF110: Map<number, number>,
): Promise<ConcUtilidadesInput> {
  const [contables, partidasAuto, partidasManuales] = await Promise.all([
    calcularContablesPyG(supabase, declaracion.id),
    calcularPartidasAuto(supabase, declaracion),
    calcularPartidasManuales(supabase, declaracion.id),
  ]);

  const utilidadContableNeta =
    num(declaracion.utilidad_contable) - num(declaracion.perdida_contable);

  return {
    utilidadContableNeta,
    contables,
    valoresF110,
    partidas: [...partidasAuto, ...partidasManuales],
  };
}
