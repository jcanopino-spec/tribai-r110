// Carga los agregados del Formato 2516 para una declaración:
//   - Suma del balance contable agrupado por las 18 filas (ESF + ERI)
//   - Ajustes manuales por fila (conversión, menor fiscal, mayor fiscal)
//   - Cálculo del valor FISCAL de cada fila
//   - Validación cruzada contra los renglones del Formulario 110
//
// El CONTABLE de las filas ESF se obtiene del último balance_prueba_lineas
// del usuario; cada cuenta PUC se clasifica vía `categorizarPucF2516`.
// Las filas ERI (12-16) y de Resultado (17-18) se derivan principalmente
// del compute del 110 (ya tenemos `numerico` con los renglones calculados),
// porque el balance puro no permite separar GO de renta ordinaria sin la
// lógica de los anexos.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  F2516_FILAS,
  type F2516FilaId,
  type F2516Fila,
  categorizarPucF2516,
  calcularFiscal,
} from "@/engine/f2516";

export type F2516AjusteRow = {
  declaracion_id: string;
  fila_id: string;
  conversion: number;
  menor_fiscal: number;
  mayor_fiscal: number;
  observacion: string | null;
};

export type F2516FilaCalculada = {
  fila: F2516Fila;
  contable: number;
  conversion: number;
  menorFiscal: number;
  mayorFiscal: number;
  fiscal: number;
  observacion: string | null;
  /** Valor del renglón equivalente en el F110 (si la fila cuadra contra alguno). */
  r110: number | null;
  /** Diferencia = fiscal − r110. Si |dif| > 0, hay descuadre. */
  diferencia: number | null;
};

/**
 * Carga el último balance del usuario y agrupa los saldos por las 8 filas
 * de activos / pasivos. Devuelve un Map<F2516FilaId, contable>.
 *
 * Convención de signos:
 *   - Activos (clase 1): saldo > 0 = activo positivo
 *   - Pasivos (clase 2): viene en negativo, lo convertimos a positivo
 *   - Ingresos (clase 4): viene en negativo (saldo crédito), abs()
 *   - Costos/gastos (5/6/7): viene en positivo (saldo débito)
 */
async function cargarContablesESF_ERI(
  supabase: SupabaseClient<Database>,
  declId: string,
): Promise<Map<F2516FilaId, number>> {
  const out = new Map<F2516FilaId, number>();
  // Inicializar todas las filas en 0
  for (const f of F2516_FILAS) out.set(f.id, 0);

  // Último balance subido
  const { data: balance } = await supabase
    .from("balance_pruebas")
    .select("id")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!balance) return out;

  const { data: lineas } = await supabase
    .from("balance_prueba_lineas")
    .select("cuenta, saldo, ajuste_debito, ajuste_credito")
    .eq("balance_id", balance.id);

  for (const l of lineas ?? []) {
    const filaId = categorizarPucF2516(l.cuenta);
    if (!filaId) continue;
    const saldo = Number(l.saldo) + Number(l.ajuste_debito) - Number(l.ajuste_credito);
    // Para pasivos / ingresos el saldo viene en negativo natural (saldo crédito).
    // Para que el F2516 lo muestre en positivo, normalizamos.
    const positivo =
      filaId === "ESF_10_PASIVOS" ||
      filaId === "ERI_12_INGRESOS" ||
      filaId === "ERI_13_DEVOL"
        ? Math.abs(saldo)
        : saldo;
    out.set(filaId, (out.get(filaId) ?? 0) + positivo);
  }

  // Total activos = suma de filas 1..8
  const totalAct =
    (out.get("ESF_01_EFECTIVO") ?? 0) +
    (out.get("ESF_02_INVERSIONES") ?? 0) +
    (out.get("ESF_03_CXC") ?? 0) +
    (out.get("ESF_04_INVENT") ?? 0) +
    (out.get("ESF_05_INTAN") ?? 0) +
    (out.get("ESF_06_BIO") ?? 0) +
    (out.get("ESF_07_PPE") ?? 0) +
    (out.get("ESF_08_OTROS") ?? 0);
  out.set("ESF_09_TOTAL_ACT", totalAct);

  // Patrimonio líquido = activos - pasivos (vista contable)
  out.set("PAT_11_LIQUIDO", totalAct - (out.get("ESF_10_PASIVOS") ?? 0));

  // Ingresos netos (vista contable simple) = brutos - devoluciones
  // El INCRNGO del balance no se separa fácilmente — queda en 0 a nivel
  // contable y solo aparece como ajuste fiscal. R110 lo trae del Anexo 26.
  out.set(
    "ERI_15_NETOS",
    (out.get("ERI_12_INGRESOS") ?? 0) - (out.get("ERI_13_DEVOL") ?? 0),
  );

  // Renta líquida contable = ingresos netos - costos
  out.set(
    "RES_17_RENTA_LIQ",
    (out.get("ERI_15_NETOS") ?? 0) - (out.get("ERI_16_COSTOS") ?? 0),
  );

  // GO contable: el balance no separa GO de renta ordinaria. Se queda en
  // 0 contablemente; el ajuste fiscal lo lleva al valor del Anexo 8.
  // out.set("RES_18_GO", 0);  ya queda en 0 por inicialización

  return out;
}

/**
 * Carga ajustes manuales del F2516 desde la tabla formato_2516_ajustes.
 * Si la tabla aún no existe (migración 026 no aplicada), devuelve Map vacío
 * para que la página siga renderizando los contables sin romper.
 */
async function cargarAjustes(
  supabase: SupabaseClient<Database>,
  declId: string,
): Promise<Map<string, F2516AjusteRow>> {
  const map = new Map<string, F2516AjusteRow>();
  const { data, error } = await supabase
    .from("formato_2516_ajustes")
    .select("*")
    .eq("declaracion_id", declId);

  // PGRST205 = tabla no existe (migración 026 pendiente). Silencioso.
  if (error && error.code !== "PGRST205") {
    console.warn("[f2516-aggregates] error cargando ajustes:", error.message);
  }

  for (const r of data ?? []) {
    map.set(r.fila_id, {
      declaracion_id: r.declaracion_id,
      fila_id: r.fila_id,
      conversion: Number(r.conversion),
      menor_fiscal: Number(r.menor_fiscal),
      mayor_fiscal: Number(r.mayor_fiscal),
      observacion: r.observacion,
    });
  }
  return map;
}

/**
 * Función principal: devuelve las 18 filas calculadas con contable, ajustes,
 * fiscal y diferencia contra el F110.
 *
 * @param renglonesF110 mapa con los valores ya computados del 110
 *   (resultado de `computarRenglones`). Se usa para validación cruzada y
 *   para alimentar el contable de filas ERI/Resultado.
 */
export async function loadF2516Aggregates(
  supabase: SupabaseClient<Database>,
  declId: string,
  renglonesF110: Map<number, number>,
): Promise<F2516FilaCalculada[]> {
  const [contables, ajustes] = await Promise.all([
    cargarContablesESF_ERI(supabase, declId),
    cargarAjustes(supabase, declId),
  ]);

  const r = (n: number) => renglonesF110.get(n) ?? 0;

  return F2516_FILAS.map((fila) => {
    const aj = ajustes.get(fila.id);
    const conversion = aj?.conversion ?? 0;
    const menorFiscal = aj?.menor_fiscal ?? 0;
    const mayorFiscal = aj?.mayor_fiscal ?? 0;
    const observacion = aj?.observacion ?? null;
    const contable = contables.get(fila.id) ?? 0;

    const fiscal = fila.esTotal
      ? calcularFiscalTotal(fila.id, contables, ajustes, r)
      : calcularFiscal({ contable, conversion, menorFiscal, mayorFiscal });

    const r110 = fila.cuadraConR110 ? r(fila.cuadraConR110) : null;
    const diferencia = r110 !== null ? fiscal - r110 : null;

    return {
      fila,
      contable,
      conversion,
      menorFiscal,
      mayorFiscal,
      fiscal,
      observacion,
      r110,
      diferencia,
    };
  });
}

/**
 * Para los totales (esTotal=true) el FISCAL no es la fórmula simple sobre
 * el contable; se computa como agregado de las filas hijas.
 */
function calcularFiscalTotal(
  filaId: F2516FilaId,
  contables: Map<F2516FilaId, number>,
  ajustes: Map<string, F2516AjusteRow>,
  r: (n: number) => number,
): number {
  const fiscalDe = (id: F2516FilaId): number => {
    const aj = ajustes.get(id);
    return calcularFiscal({
      contable: contables.get(id) ?? 0,
      conversion: aj?.conversion ?? 0,
      menorFiscal: aj?.menor_fiscal ?? 0,
      mayorFiscal: aj?.mayor_fiscal ?? 0,
    });
  };

  switch (filaId) {
    case "ESF_09_TOTAL_ACT":
      return (
        fiscalDe("ESF_01_EFECTIVO") +
        fiscalDe("ESF_02_INVERSIONES") +
        fiscalDe("ESF_03_CXC") +
        fiscalDe("ESF_04_INVENT") +
        fiscalDe("ESF_05_INTAN") +
        fiscalDe("ESF_06_BIO") +
        fiscalDe("ESF_07_PPE") +
        fiscalDe("ESF_08_OTROS")
      );
    case "ERI_15_NETOS":
      // Ingresos netos fiscales = R61 (ya está computado por engine)
      return r(61);
    case "RES_17_RENTA_LIQ":
      // Renta líquida gravable = R79
      return r(79);
    case "RES_18_GO":
      // GO gravables = R83
      return r(83);
    default:
      return 0;
  }
}
