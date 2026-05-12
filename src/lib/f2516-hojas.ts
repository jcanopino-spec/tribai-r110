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
// Estructura oficial DIAN modelo110.xlsm (~42 campos):
//   1. Identificación (NIT, razón social, dirección)
//   2. Tarifa aplicable + artículo (Art. 240, 240-1, 19-4, etc.)
//   3. Datos informativos · 22 flags SI/NO (campos 30-51 MUISCA)
//   4. Signatario + códigos representación/contador/RF (campos 89-997)
export type F2516H1Caratula = {
  declaracion_id: string;
  // Bloque 1 · Representante legal, contador, RF
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
  // Bloque 2 · Tarifa
  tarifa_aplicable: number | null;
  art_aplicable: string | null;
  // Bloque 3 · 22 flags MUISCA (campos 30-51)
  pn_sin_residencia: boolean;
  rte: boolean;
  entidad_cooperativa: boolean;
  entidad_sector_financiero: boolean;
  nueva_sociedad_zomac: boolean;
  obras_por_impuestos_zomac: boolean;
  reorganizacion_empresarial: boolean;
  soc_extranjera_transporte: boolean;
  sist_especial_valoracion: boolean;
  costo_inv_juego_inv: boolean;
  costo_inv_simultaneo: boolean;
  progresividad_tarifa: boolean;
  contrato_estabilidad: boolean;
  moneda_funcional_diferente: boolean;
  mega_inversiones: boolean;
  economia_naranja: boolean;
  holding_colombiana: boolean;
  zese: boolean;
  extraccion_hulla_carbon: boolean;
  extraccion_petroleo: boolean;
  generacion_energia_hidro: boolean;
  zona_franca: boolean;
  // Bloque 4 · Signatario y representación
  signatario_nit: string | null;
  signatario_dv: string | null;
  codigo_representacion: string | null;
  codigo_contador_rf: string | null;
  numero_tarjeta_profesional: string | null;
  con_salvedades: boolean;
  fecha_efectiva_transaccion: string | null;
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

// ============================================================
// AUTO-ALIMENTACIÓN H5 / H6 desde balance
// ============================================================
// Replica el modelo del archivo Aries (actualicese):
//   H5 "Ingresos y Facturación" se alimenta de las subcuentas 41XX
//     (Detalle renglones F394:F399 para bienes, F402:F418 para servicios)
//   H6 "Activos Fijos" se alimenta de subcuentas 15XX (PPE), 16XX (intangibles)
//     y 1592 (depreciación acumulada).
//
// El usuario puede SOBRESCRIBIR los valores auto-calculados capturando
// manualmente · si hay captura en la tabla, esa gana; sino, se computa
// desde el balance con filtro anti-duplicación (es_hoja).

type BalanceLinea = { cuenta: string; saldo: number };

async function cargarBalanceParaAuto(
  supabase: SC,
  declId: string,
): Promise<BalanceLinea[]> {
  const { data } = await supabase
    .from("balance_prueba_lineas")
    .select(
      "cuenta, saldo, ajuste_debito, ajuste_credito, balance_id, balance_pruebas!inner(declaracion_id)",
    )
    .eq("balance_pruebas.declaracion_id", declId);

  return (data ?? []).map((l) => ({
    cuenta: String(l.cuenta),
    saldo:
      Number(l.saldo) +
      Number(l.ajuste_debito ?? 0) -
      Number(l.ajuste_credito ?? 0),
  }));
}

function esHojaFactory(lineas: BalanceLinea[]) {
  const cuentas = new Set(lineas.map((l) => l.cuenta));
  return (cuenta: string): boolean => {
    for (const otra of cuentas) {
      if (otra.length > cuenta.length && otra.startsWith(cuenta)) return false;
    }
    return true;
  };
}

function sumByPrefixes(
  lineas: BalanceLinea[],
  esHoja: (c: string) => boolean,
  incluir: string[],
  excluir: string[] = [],
): number {
  return lineas
    .filter((l) => {
      if (!incluir.some((p) => l.cuenta.startsWith(p))) return false;
      if (excluir.some((p) => l.cuenta.startsWith(p))) return false;
      return esHoja(l.cuenta);
    })
    .reduce((s, l) => s + Math.abs(l.saldo), 0);
}

// ---------- H5 Ingresos y Facturación ----------
//
// Auto-cálculo por concepto desde el balance:
//   VENTAS_BIENES_NAC    · 4135 (Comercio al por mayor y menor)
//   VENTAS_COMERCIALIZ   · (manual · no se infiere automáticamente)
//   SERVICIOS_NAC        · 4140 (Generación energía/industria) + 4145 +
//                          4150 + 4155 + 4160 + 4165 + 4170
//   SERVICIOS_EXP        · (manual)
//   COMISIONES           · 4155 (subcuenta de 4150 financiero · simplificación)
//   HONORARIOS           · (manual · típicamente parte de 4170 consultoría)
//   ARRENDAMIENTOS       · (manual · típicamente 4155)
//   RECUPERACIONES       · 425* (recuperaciones e indemnizaciones)
//   INTERESES            · 421* (rendimientos financieros)
//   DIVERSOS             · 4295 (ingresos diversos)
//
// Los conceptos sin auto-mapeo claro quedan en 0; el usuario los captura
// manualmente. Por ahora todo se mapea a la columna "gravados" porque el
// balance no distingue gravado/exento/excluido/exportación · esa
// clasificación es un input del contador.
// Catálogo oficial DIAN H5 (modelo110.xlsm) · 5 conceptos del MUISCA.
// Cada uno se auto-puebla desde el balance con los prefijos PUC oficiales:
//   VENTA_BIENES         · 4135 (Comercio al por mayor y menor) + 4140 (parcial · venta industria)
//   PRESTACION_SERVICIOS · 4145-4170 (servicios financieros, inmobiliarios, sociales, salud, enseñanza, consultoría)
//   OTROS_INGRESOS       · 42* (todos los no operacionales)
//   INGRESOS_TERCEROS    · capturado manual
//   AJUSTES_FACTURADO    · 4175 (devoluciones, rebajas y descuentos)
const H5_AUTO_PREFIJOS: Record<string, { incluir: string[]; excluir?: string[] } | null> = {
  VENTA_BIENES: { incluir: ["4135", "4140"] },
  PRESTACION_SERVICIOS: { incluir: ["4145", "4150", "4155", "4160", "4165", "4170"] },
  OTROS_INGRESOS: { incluir: ["42"], excluir: ["4275"] },
  INGRESOS_TERCEROS: null,
  AJUSTES_FACTURADO: { incluir: ["4175"] },
};

export async function loadF2516H5(
  supabase: SC,
  declId: string,
): Promise<F2516H5Resumen> {
  const [{ data: ingresos }, { data: conciliacion }, lineas] = await Promise.all([
    supabase
      .from("formato_2516_h5_ingresos")
      .select("*")
      .eq("declaracion_id", declId),
    supabase
      .from("formato_2516_h5_conciliacion")
      .select("*")
      .eq("declaracion_id", declId)
      .maybeSingle(),
    cargarBalanceParaAuto(supabase, declId),
  ]);

  const esHoja = esHojaFactory(lineas);
  const capturasManuales = (ingresos ?? []).reduce<Map<string, F2516H5Captura>>(
    (m, d) => {
      m.set(String(d.concepto_id), {
        declaracion_id: d.declaracion_id as string,
        concepto_id: d.concepto_id as string,
        concepto: d.concepto as string,
        gravados: Number(d.gravados),
        exentos: Number(d.exentos),
        excluidos: Number(d.excluidos),
        exportacion: Number(d.exportacion),
        observacion: (d.observacion as string | null) ?? null,
      });
      return m;
    },
    new Map(),
  );

  // Construir capturas mezclando auto + manual (manual gana si tiene datos > 0)
  const capturas: F2516H5Captura[] = [];
  for (const concepto of F2516_H5_CONCEPTOS) {
    const manual = capturasManuales.get(concepto.id);
    const totalManual = manual
      ? manual.gravados + manual.exentos + manual.excluidos + manual.exportacion
      : 0;

    if (totalManual > 0) {
      capturas.push(manual!);
      continue;
    }

    // Auto desde balance
    const cfg = H5_AUTO_PREFIJOS[concepto.id];
    const autoValor = cfg
      ? sumByPrefixes(lineas, esHoja, cfg.incluir, cfg.excluir)
      : 0;
    capturas.push({
      declaracion_id: declId,
      concepto_id: concepto.id,
      concepto: concepto.concepto,
      // Auto-poblado va a "gravados" (el contador puede reclasificar luego)
      gravados: autoValor,
      exentos: 0,
      excluidos: 0,
      exportacion: 0,
      observacion: autoValor > 0 ? "Auto-poblado desde balance" : null,
    });
  }

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
//
// Auto-cálculo desde balance:
//   TERRENOS              · 1504 (Terrenos)
//   EDIFICACIONES         · 1516 (Construcciones y edificaciones) + 1512 (Maquinaria · variante)
//   MAQUINARIA            · 1520 (Maquinaria y equipo)
//   EQUIPO_OFICINA        · 1524 (Equipo de oficina)
//   COMPUTO               · 1528 (Equipo de computación y comunicación)
//   VEHICULOS             · 1540 (Flota y equipo de transporte)
//   MUEBLES               · 1524 (compartido con equipo de oficina)
//   CONSTRUCCIONES_CURSO  · 1504 (Construcciones en curso · 150x)
//   SOFTWARE              · 1635 (Programas para computador) o 1660
//   MARCAS_PATENTES       · 1605 (Crédito mercantil) + 1610 (Marcas) + 1615 (Patentes)
//   PLUSVALIA             · 1605
//   OTROS_INTANGIBLES     · 16XX restante
//
// Depreciación acumulada del balance va a `deprec_acumulada`:
//   1592 (depreciación acumulada PP&E) → distribuir entre categorías de PPE
//   1675 (amortización acumulada intangibles)
const H6_AUTO_PREFIJOS_PPE: Record<string, string[]> = {
  TERRENOS: ["1504"],
  EDIFICACIONES: ["1516"],
  MAQUINARIA: ["1520"],
  EQUIPO_OFICINA: ["1524"],
  COMPUTO: ["1528"],
  VEHICULOS: ["1540"],
  MUEBLES: ["1524"],
  CONSTRUCCIONES_CURSO: ["1599"],
};
const H6_AUTO_PREFIJOS_INTANGIBLES: Record<string, string[]> = {
  SOFTWARE: ["1635"],
  MARCAS_PATENTES: ["1610", "1615"],
  PLUSVALIA: ["1605"],
  OTROS_INTANGIBLES: ["1625", "1630", "1640", "1645", "1650", "1655", "1660", "1665", "1670"],
};

export async function loadF2516H6(
  supabase: SC,
  declId: string,
): Promise<F2516H6Resumen> {
  const [{ data }, lineas] = await Promise.all([
    supabase
      .from("formato_2516_h6_activos_fijos")
      .select("*")
      .eq("declaracion_id", declId),
    cargarBalanceParaAuto(supabase, declId),
  ]);

  const esHoja = esHojaFactory(lineas);

  // Depreciación acumulada PPE (1592) · se distribuye PRO-RATA entre categorías
  // con saldo > 0 en columna Costo. Total depreciación se calcula primero.
  const deprAcumPPE = sumByPrefixes(lineas, esHoja, ["1592"]);
  const amorAcumIntangibles = sumByPrefixes(lineas, esHoja, ["1675"]);

  // Pre-calcular costos auto por categoría
  const costosAuto: Record<string, number> = {};
  for (const [catId, prefijos] of Object.entries(H6_AUTO_PREFIJOS_PPE)) {
    costosAuto[catId] = sumByPrefixes(lineas, esHoja, prefijos);
  }
  for (const [catId, prefijos] of Object.entries(H6_AUTO_PREFIJOS_INTANGIBLES)) {
    costosAuto[catId] = sumByPrefixes(lineas, esHoja, prefijos);
  }

  // Sumas para pro-rata depreciación
  const totalCostoPPE = Object.entries(costosAuto)
    .filter(([id]) => H6_AUTO_PREFIJOS_PPE[id])
    .reduce((s, [, v]) => s + v, 0);
  const totalCostoIntangibles = Object.entries(costosAuto)
    .filter(([id]) => H6_AUTO_PREFIJOS_INTANGIBLES[id])
    .reduce((s, [, v]) => s + v, 0);

  const capturasManuales = new Map<string, F2516H6Captura>();
  for (const d of data ?? []) {
    capturasManuales.set(String(d.categoria_id), {
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
    });
  }

  const capturas: F2516H6Captura[] = [];
  for (const cat of F2516_H6_CATEGORIAS) {
    const manual = capturasManuales.get(cat.id);
    const totalManual = manual
      ? Math.abs(manual.saldo_inicial) +
        Math.abs(manual.adiciones) +
        Math.abs(manual.retiros) +
        Math.abs(manual.deprec_acumulada) +
        Math.abs(manual.deprec_ano) +
        Math.abs(manual.ajuste_fiscal)
      : 0;

    if (totalManual > 0) {
      capturas.push(manual!);
      continue;
    }

    // Auto desde balance
    const costoAuto = costosAuto[cat.id] ?? 0;
    let deprecAuto = 0;
    if (costoAuto > 0) {
      if (cat.tipo === "ppe" && totalCostoPPE > 0) {
        // Pro-rata depreciación PPE
        deprecAuto = (costoAuto / totalCostoPPE) * deprAcumPPE;
      } else if (cat.tipo === "intangible" && totalCostoIntangibles > 0) {
        deprecAuto = (costoAuto / totalCostoIntangibles) * amorAcumIntangibles;
      }
    }

    capturas.push({
      declaracion_id: declId,
      categoria_id: cat.id,
      categoria: cat.categoria,
      saldo_inicial: costoAuto, // saldo final del costo (sin movimientos del año desglosados)
      adiciones: 0,
      retiros: 0,
      deprec_acumulada: deprecAuto,
      deprec_ano: 0,
      ajuste_fiscal: 0,
      observacion: costoAuto > 0 ? "Auto-poblado desde balance" : null,
    });
  }

  return computarH6(capturas);
}

// Re-exports para conveniencia desde las páginas
export { F2516_H4_CATEGORIAS, F2516_H5_CONCEPTOS, F2516_H6_CATEGORIAS };
