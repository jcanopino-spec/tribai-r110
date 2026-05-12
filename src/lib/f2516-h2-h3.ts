// Loader F2516 H2 (ESF Patrimonio) + H3 (ERI Renta Líquida)
//
// Estructura oficial DIAN modelo110.xlsm:
//   · H2 · 250 renglones · 5 columnas valor (Val1..Val5)
//   · H3 · 590 renglones · 12 columnas valor (Val1..Val12)
//
// El valor contable (Val1) se computa desde el balance vía el mapeo
// balance_renglon_h2_h3. Los ajustes (Val2..Val4 para H2; Val2..Val4 +
// Val6..Val12 para H3) son captura manual del contador.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { F2516_H2_CATALOGO, type F2516_H2Renglon } from "@/engine/f2516-h2-catalogo";
import { F2516_H3_CATALOGO, type F2516_H3Renglon } from "@/engine/f2516-h3-catalogo";

type SC = SupabaseClient<Database>;

export type F2516H2Ajuste = {
  renglon_id: number;
  conversion: number;
  menor_fiscal: number;
  mayor_fiscal: number;
  observacion: string | null;
};

export type F2516H3Ajuste = F2516H2Ajuste & {
  rl_tarifa_general: number;
  rl_zf: number;
  rl_ece: number;
  rl_mega_inv: number;
  rl_par5: number;
  rl_dividendos: number;
  rl_go: number;
};

export type F2516H2Fila = F2516_H2Renglon & {
  contable: number;
  conversion: number;
  menor_fiscal: number;
  mayor_fiscal: number;
  fiscal: number; // Val5 = Val1 + Val2 − Val3 + Val4
  observacion: string | null;
};

export type F2516H3Fila = F2516_H3Renglon & {
  contable: number;
  conversion: number;
  menor_fiscal: number;
  mayor_fiscal: number;
  fiscal: number;
  rl_tarifa_general: number;
  rl_zf: number;
  rl_ece: number;
  rl_mega_inv: number;
  rl_par5: number;
  rl_dividendos: number;
  rl_go: number;
  observacion: string | null;
};

/**
 * Carga el balance del usuario y suma por renglón H2 según el mapeo en
 * balance_renglon_h2_h3. Las cuentas sin mapeo NO entran al H2.
 */
async function cargarContablesH2(
  supabase: SC,
  declId: string,
): Promise<Map<number, number>> {
  const { data } = await supabase
    .from("balance_renglon_h2_h3")
    .select("cuenta, renglon_h2")
    .eq("declaracion_id", declId)
    .not("renglon_h2", "is", null);

  const mapping = new Map<string, number>();
  for (const r of data ?? []) {
    if (r.renglon_h2 != null) mapping.set(String(r.cuenta), r.renglon_h2);
  }

  // Cargar saldos
  const { data: lineas } = await supabase
    .from("balance_prueba_lineas")
    .select("cuenta, saldo, ajuste_debito, ajuste_credito, balance_pruebas!inner(declaracion_id)")
    .eq("balance_pruebas.declaracion_id", declId);

  const totales = new Map<number, number>();
  for (const l of lineas ?? []) {
    const rgl = mapping.get(String(l.cuenta));
    if (rgl == null) continue;
    const saldo =
      Number(l.saldo) + Number(l.ajuste_debito ?? 0) - Number(l.ajuste_credito ?? 0);
    totales.set(rgl, (totales.get(rgl) ?? 0) + Math.abs(saldo));
  }
  return totales;
}

async function cargarContablesH3(
  supabase: SC,
  declId: string,
): Promise<Map<number, number>> {
  const { data } = await supabase
    .from("balance_renglon_h2_h3")
    .select("cuenta, renglon_h3")
    .eq("declaracion_id", declId)
    .not("renglon_h3", "is", null);

  const mapping = new Map<string, number>();
  for (const r of data ?? []) {
    if (r.renglon_h3 != null) mapping.set(String(r.cuenta), r.renglon_h3);
  }

  const { data: lineas } = await supabase
    .from("balance_prueba_lineas")
    .select("cuenta, saldo, ajuste_debito, ajuste_credito, balance_pruebas!inner(declaracion_id)")
    .eq("balance_pruebas.declaracion_id", declId);

  const totales = new Map<number, number>();
  for (const l of lineas ?? []) {
    const rgl = mapping.get(String(l.cuenta));
    if (rgl == null) continue;
    const saldo =
      Number(l.saldo) + Number(l.ajuste_debito ?? 0) - Number(l.ajuste_credito ?? 0);
    totales.set(rgl, (totales.get(rgl) ?? 0) + Math.abs(saldo));
  }
  return totales;
}

export async function loadF2516H2(supabase: SC, declId: string): Promise<F2516H2Fila[]> {
  const [contables, { data: ajustes }] = await Promise.all([
    cargarContablesH2(supabase, declId),
    supabase
      .from("formato_2516_h2_ajustes")
      .select("renglon_id, conversion, menor_fiscal, mayor_fiscal, observacion")
      .eq("declaracion_id", declId),
  ]);

  const ajustesMap = new Map<number, F2516H2Ajuste>();
  for (const a of ajustes ?? []) {
    ajustesMap.set(Number(a.renglon_id), {
      renglon_id: Number(a.renglon_id),
      conversion: Number(a.conversion),
      menor_fiscal: Number(a.menor_fiscal),
      mayor_fiscal: Number(a.mayor_fiscal),
      observacion: (a.observacion as string | null) ?? null,
    });
  }

  // Construir filas calculadas con totales jerárquicos
  return computarH2Total(contables, ajustesMap);
}

export async function loadF2516H3(supabase: SC, declId: string): Promise<F2516H3Fila[]> {
  const [contables, { data: ajustes }] = await Promise.all([
    cargarContablesH3(supabase, declId),
    supabase
      .from("formato_2516_h3_ajustes")
      .select("*")
      .eq("declaracion_id", declId),
  ]);

  const ajustesMap = new Map<number, F2516H3Ajuste>();
  for (const a of ajustes ?? []) {
    ajustesMap.set(Number(a.renglon_id), {
      renglon_id: Number(a.renglon_id),
      conversion: Number(a.conversion),
      menor_fiscal: Number(a.menor_fiscal),
      mayor_fiscal: Number(a.mayor_fiscal),
      rl_tarifa_general: Number(a.rl_tarifa_general),
      rl_zf: Number(a.rl_zf),
      rl_ece: Number(a.rl_ece),
      rl_mega_inv: Number(a.rl_mega_inv),
      rl_par5: Number(a.rl_par5),
      rl_dividendos: Number(a.rl_dividendos),
      rl_go: Number(a.rl_go),
      observacion: (a.observacion as string | null) ?? null,
    });
  }

  return computarH3Total(contables, ajustesMap);
}

/**
 * Construye filas H2 con totales rolling-up por jerarquía.
 * Los renglones esTotal=true suman los hijos contiguos del mismo nivel + 1.
 */
function computarH2Total(
  contables: Map<number, number>,
  ajustes: Map<number, F2516H2Ajuste>,
): F2516H2Fila[] {
  // Pre-computar val5 (fiscal) por renglón a partir de val1 (contable) + ajustes
  const valor: Record<number, F2516H2Fila> = {};
  for (const r of F2516_H2_CATALOGO) {
    const c = contables.get(r.id) ?? 0;
    const a = ajustes.get(r.id);
    const conv = a?.conversion ?? 0;
    const menor = a?.menor_fiscal ?? 0;
    const mayor = a?.mayor_fiscal ?? 0;
    valor[r.id] = {
      ...r,
      contable: c,
      conversion: conv,
      menor_fiscal: menor,
      mayor_fiscal: mayor,
      fiscal: c + conv - menor + mayor,
      observacion: a?.observacion ?? null,
    };
  }
  // Para totales · sumar los renglones hijos siguientes hasta encontrar otro del mismo nivel
  // (modelo del Excel: cada total padre suma renglones hijos contiguos).
  for (let i = 0; i < F2516_H2_CATALOGO.length; i++) {
    const r = F2516_H2_CATALOGO[i];
    if (!r.esTotal) continue;
    let cAcum = 0, convAcum = 0, menorAcum = 0, mayorAcum = 0, fAcum = 0;
    for (let j = i + 1; j < F2516_H2_CATALOGO.length; j++) {
      const child = F2516_H2_CATALOGO[j];
      if (child.nivel <= r.nivel) break; // siguiente sección
      if (child.esTotal) continue; // saltar subtotales (evita doble cuenta)
      const cv = valor[child.id];
      cAcum += cv.contable;
      convAcum += cv.conversion;
      menorAcum += cv.menor_fiscal;
      mayorAcum += cv.mayor_fiscal;
      fAcum += cv.fiscal;
    }
    valor[r.id] = {
      ...valor[r.id],
      contable: cAcum,
      conversion: convAcum,
      menor_fiscal: menorAcum,
      mayor_fiscal: mayorAcum,
      fiscal: fAcum,
    };
  }
  return F2516_H2_CATALOGO.map((r) => valor[r.id]);
}

function computarH3Total(
  contables: Map<number, number>,
  ajustes: Map<number, F2516H3Ajuste>,
): F2516H3Fila[] {
  const valor: Record<number, F2516H3Fila> = {};
  for (const r of F2516_H3_CATALOGO) {
    const c = contables.get(r.id) ?? 0;
    const a = ajustes.get(r.id);
    const conv = a?.conversion ?? 0;
    const menor = a?.menor_fiscal ?? 0;
    const mayor = a?.mayor_fiscal ?? 0;
    valor[r.id] = {
      ...r,
      contable: c,
      conversion: conv,
      menor_fiscal: menor,
      mayor_fiscal: mayor,
      fiscal: c + conv - menor + mayor,
      rl_tarifa_general: a?.rl_tarifa_general ?? 0,
      rl_zf: a?.rl_zf ?? 0,
      rl_ece: a?.rl_ece ?? 0,
      rl_mega_inv: a?.rl_mega_inv ?? 0,
      rl_par5: a?.rl_par5 ?? 0,
      rl_dividendos: a?.rl_dividendos ?? 0,
      rl_go: a?.rl_go ?? 0,
      observacion: a?.observacion ?? null,
    };
  }
  for (let i = 0; i < F2516_H3_CATALOGO.length; i++) {
    const r = F2516_H3_CATALOGO[i];
    if (!r.esTotal) continue;
    const acum = {
      contable: 0, conversion: 0, menor_fiscal: 0, mayor_fiscal: 0, fiscal: 0,
      rl_tarifa_general: 0, rl_zf: 0, rl_ece: 0, rl_mega_inv: 0, rl_par5: 0,
      rl_dividendos: 0, rl_go: 0,
    };
    for (let j = i + 1; j < F2516_H3_CATALOGO.length; j++) {
      const child = F2516_H3_CATALOGO[j];
      if (child.nivel <= r.nivel) break;
      if (child.esTotal) continue;
      const cv = valor[child.id];
      acum.contable += cv.contable;
      acum.conversion += cv.conversion;
      acum.menor_fiscal += cv.menor_fiscal;
      acum.mayor_fiscal += cv.mayor_fiscal;
      acum.fiscal += cv.fiscal;
      acum.rl_tarifa_general += cv.rl_tarifa_general;
      acum.rl_zf += cv.rl_zf;
      acum.rl_ece += cv.rl_ece;
      acum.rl_mega_inv += cv.rl_mega_inv;
      acum.rl_par5 += cv.rl_par5;
      acum.rl_dividendos += cv.rl_dividendos;
      acum.rl_go += cv.rl_go;
    }
    valor[r.id] = { ...valor[r.id], ...acum };
  }
  return F2516_H3_CATALOGO.map((r) => valor[r.id]);
}

// Re-exports para conveniencia
export { F2516_H2_CATALOGO, F2516_H3_CATALOGO };
export type { F2516_H2Renglon, F2516_H3Renglon };
