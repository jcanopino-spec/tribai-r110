"use server";

import * as XLSX from "xlsx";
import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { RENGLONES_COMPUTADOS } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";

export type CuentaSinMapear = {
  cuenta: string;
  nombre: string | null;
  saldo: number;
};

export type UploadResult = {
  error: string | null;
  filename: string | null;
  totalLineas: number;
  mapeadas: number;
  sinMapear: number;
  renglonesActualizados: number;
  sample: { cuenta: string; nombre: string | null; saldo: number; renglon: number | null }[];
  sinMapearCuentas: CuentaSinMapear[];
};

const EMPTY: UploadResult = {
  error: null,
  filename: null,
  totalLineas: 0,
  mapeadas: 0,
  sinMapear: 0,
  renglonesActualizados: 0,
  sample: [],
  sinMapearCuentas: [],
};

const ACCEPTED_EXT = [".xlsx", ".xls", ".xlsm", ".csv"];

function normalizeCuenta(raw: unknown): string {
  return String(raw ?? "").replace(/[^0-9]/g, "");
}

function parseSaldo(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  let cleaned = s.replace(/[^0-9.,-]/g, "");
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    else cleaned = cleaned.replace(/,/g, "");
  } else if (lastComma !== -1) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if ((cleaned.match(/\./g) ?? []).length > 1) {
    cleaned = cleaned.replace(/\./g, "");
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function looksLikePucCode(raw: unknown): boolean {
  const s = normalizeCuenta(raw);
  return s.length >= 1 && s.length <= 6;
}

function looksLikeNumber(raw: unknown): boolean {
  if (typeof raw === "number") return true;
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return false;
  return /^-?[\d.,]+$/.test(s);
}

type Layout = {
  headerIdx: number; // -1 if no header
  cuentaCol: number;
  nombreCol: number;
  saldoCol: number;
};

function detectLayout(rows: unknown[][]): Layout | null {
  // 1) Try to find a header row in the first 15 rows
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const cells = rows[i].map((c) => String(c ?? "").toLowerCase().trim());
    const cuentaCol = cells.findIndex(
      (c) => c.includes("cuenta") || c === "puc" || c.includes("código"),
    );
    const saldoCol = cells.findIndex((c) => c.includes("saldo") || c.includes("valor"));
    if (cuentaCol !== -1 && saldoCol !== -1 && cuentaCol !== saldoCol) {
      const nombreCol = cells.findIndex(
        (c) => c.includes("nombre") || c.includes("descripc"),
      );
      return { headerIdx: i, cuentaCol, nombreCol, saldoCol };
    }
  }

  // 2) No header found. Try positional detection. Look at the first 20 data
  //    rows and find a column where >=70% of values look like PUC codes, and
  //    a different column where >=70% of values look like numbers (saldos).
  const nCols = Math.max(...rows.slice(0, 30).map((r) => r?.length ?? 0));
  if (nCols < 2) return null;

  const sample = rows.slice(0, 30).filter((r) => r && r.length > 0);
  if (sample.length < 3) return null;

  const colStats = Array.from({ length: nCols }, (_, c) => {
    let pucLike = 0;
    let numLike = 0;
    let nonEmpty = 0;
    for (const r of sample) {
      const v = r[c];
      if (v == null || (typeof v === "string" && !v.trim())) continue;
      nonEmpty++;
      if (looksLikePucCode(v)) pucLike++;
      if (looksLikeNumber(v)) numLike++;
    }
    return { c, pucLike, numLike, nonEmpty };
  });

  const cuentaCol = colStats
    .slice()
    .sort((a, b) => b.pucLike / Math.max(1, b.nonEmpty) - a.pucLike / Math.max(1, a.nonEmpty))[0];
  if (!cuentaCol || cuentaCol.nonEmpty === 0 || cuentaCol.pucLike / cuentaCol.nonEmpty < 0.7)
    return null;

  const saldoCol = colStats
    .filter((s) => s.c !== cuentaCol.c)
    .sort((a, b) => b.numLike / Math.max(1, b.nonEmpty) - a.numLike / Math.max(1, a.nonEmpty))[0];
  if (!saldoCol || saldoCol.nonEmpty === 0 || saldoCol.numLike / saldoCol.nonEmpty < 0.5)
    return null;

  // Nombre = primer otra columna textual entre cuenta y saldo (o cualquiera distinta)
  const nombreCol =
    colStats
      .filter((s) => s.c !== cuentaCol.c && s.c !== saldoCol.c)
      .find((s) => s.nonEmpty > 0)?.c ?? -1;

  return {
    headerIdx: -1,
    cuentaCol: cuentaCol.c,
    nombreCol,
    saldoCol: saldoCol.c,
  };
}

export async function uploadBalanceAction(
  declId: string,
  empresaId: string,
  _prev: UploadResult,
  form: FormData,
): Promise<UploadResult> {
  const file = form.get("file") as File | null;
  if (!file || file.size === 0) {
    return { ...EMPTY, error: "Selecciona un archivo." };
  }
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ACCEPTED_EXT.includes(ext)) {
    return { ...EMPTY, error: `Formato no soportado. Usa ${ACCEPTED_EXT.join(", ")}.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...EMPTY, error: "Sesión expirada." };

  const buf = await file.arrayBuffer();
  let rows: unknown[][];
  try {
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];
  } catch (e) {
    return { ...EMPTY, error: `No se pudo leer el archivo: ${(e as Error).message}` };
  }

  const layout = detectLayout(rows);
  if (!layout) {
    return {
      ...EMPTY,
      error:
        "No pude detectar las columnas. Asegúrate de que el archivo tenga una columna con códigos PUC y otra con saldos numéricos.",
    };
  }

  const startRow = layout.headerIdx + 1;
  const { cuentaCol, nombreCol, saldoCol } = layout;

  type Linea = { cuenta: string; nombre: string | null; saldo: number };
  const lineas: Linea[] = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const cuenta = normalizeCuenta(row[cuentaCol]);
    if (!cuenta) continue;
    const nombre =
      nombreCol >= 0 ? String(row[nombreCol] ?? "").trim() || null : null;
    const saldo = parseSaldo(row[saldoCol]);
    if (saldo === 0 && !nombre && cuenta.length < 4) continue;
    lineas.push({ cuenta, nombre, saldo });
  }

  if (lineas.length === 0) {
    return { ...EMPTY, error: "El archivo no contiene filas con cuenta y saldo." };
  }

  // Reunimos todos los códigos posibles: cuenta tal cual + padre 4-dígitos si tiene 6+
  const candidatos = new Set<string>();
  for (const l of lineas) {
    candidatos.add(l.cuenta);
    if (l.cuenta.length >= 6) candidatos.add(l.cuenta.slice(0, 4));
    if (l.cuenta.length >= 4) candidatos.add(l.cuenta.slice(0, 2));
  }

  // 1) Overrides de la empresa (toman precedencia)
  const { data: overrides } = await supabase
    .from("puc_overrides")
    .select("puc, renglon_110")
    .eq("empresa_id", empresaId)
    .in("puc", [...candidatos]);
  const overrideMap = new Map<string, number | null>(
    (overrides ?? []).map((o) => [o.puc, o.renglon_110]),
  );

  // 2) Catálogo global
  const { data: pucs } = await supabase
    .from("puc_accounts")
    .select("puc, renglon_110")
    .in("puc", [...candidatos]);
  const catalogMap = new Map<string, number | null>(
    (pucs ?? []).map((p) => [p.puc, p.renglon_110]),
  );

  function resolveRenglon(puc: string): number | null {
    // override exacto > catálogo exacto > padre 4d > padre 2d
    if (overrideMap.has(puc)) return overrideMap.get(puc) ?? null;
    if (catalogMap.has(puc) && catalogMap.get(puc) != null)
      return catalogMap.get(puc) ?? null;
    if (puc.length >= 6) {
      const parent4 = puc.slice(0, 4);
      if (overrideMap.has(parent4)) return overrideMap.get(parent4) ?? null;
      const r = catalogMap.get(parent4);
      if (r != null) return r;
    }
    if (puc.length >= 4) {
      const parent2 = puc.slice(0, 2);
      if (overrideMap.has(parent2)) return overrideMap.get(parent2) ?? null;
      const r = catalogMap.get(parent2);
      if (r != null) return r;
    }
    return null;
  }

  // Replace any prior balance for this declaracion
  await supabase.from("balance_pruebas").delete().eq("declaracion_id", declId);

  const { data: balance, error: balErr } = await supabase
    .from("balance_pruebas")
    .insert({ declaracion_id: declId, filename: file.name })
    .select("id")
    .single();
  if (balErr) return { ...EMPTY, error: balErr.message };

  const lineasPayload = lineas.map((l) => ({
    balance_id: balance.id,
    cuenta: l.cuenta,
    nombre: l.nombre,
    saldo: l.saldo,
    renglon_110: resolveRenglon(l.cuenta),
  }));

  for (let i = 0; i < lineasPayload.length; i += 500) {
    const chunk = lineasPayload.slice(i, i + 500);
    const { error } = await supabase.from("balance_prueba_lineas").insert(chunk);
    if (error) return { ...EMPTY, error: `Error guardando líneas: ${error.message}` };
  }

  const aggByRenglon = new Map<number, number>();
  let mapeadas = 0;
  const sinMapearMap = new Map<string, CuentaSinMapear>();
  for (const l of lineasPayload) {
    const isAux = l.cuenta.length >= 6;
    if (l.renglon_110 != null) mapeadas++;
    if (l.renglon_110 != null && isAux && !RENGLONES_COMPUTADOS.has(l.renglon_110)) {
      aggByRenglon.set(
        l.renglon_110,
        (aggByRenglon.get(l.renglon_110) ?? 0) + Number(l.saldo),
      );
    }
    if (l.renglon_110 == null && isAux) {
      // Solo reportamos las auxiliares sin mapear (las de mayor las ignoramos)
      const prev = sinMapearMap.get(l.cuenta);
      sinMapearMap.set(l.cuenta, {
        cuenta: l.cuenta,
        nombre: l.nombre ?? prev?.nombre ?? null,
        saldo: (prev?.saldo ?? 0) + Number(l.saldo),
      });
    }
  }
  const sinMapearCuentas = [...sinMapearMap.values()].sort((a, b) =>
    Math.abs(b.saldo) - Math.abs(a.saldo),
  );

  let renglonesActualizados = 0;
  if (aggByRenglon.size > 0) {
    const valoresPayload = [...aggByRenglon.entries()].map(([numero, valor]) => ({
      declaracion_id: declId,
      numero,
      valor: Math.round(normalizarSigno(numero, valor)),
    }));
    const { error } = await supabase
      .from("form110_valores")
      .upsert(valoresPayload, { onConflict: "declaracion_id,numero" });
    if (error) return { ...EMPTY, error: `Error guardando valores: ${error.message}` };
    renglonesActualizados = valoresPayload.length;
  }

  await supabase
    .from("declaraciones")
    .update({ modo_carga: "balance", updated_at: new Date().toISOString() })
    .eq("id", declId);

  revalidateDeclaracion(empresaId, declId);

  return {
    error: null,
    filename: file.name,
    totalLineas: lineas.length,
    mapeadas,
    sinMapear: lineas.filter((l) => l.cuenta.length >= 6).length - mapeadas,
    renglonesActualizados,
    sample: lineasPayload.slice(0, 8).map((l) => ({
      cuenta: l.cuenta,
      nombre: l.nombre,
      saldo: Number(l.saldo),
      renglon: l.renglon_110,
    })),
    sinMapearCuentas: sinMapearCuentas.slice(0, 100),
  };
}

// ---------- Re-procesar el balance actual con nuevas overrides ----------

/**
 * Guarda ajustes fiscales (débito / crédito / observación) por cuenta y
 * re-agrega los renglones del 110 usando el saldo fiscal.
 */
export async function saveAjustesFiscalesAction(
  empresaId: string,
  declId: string,
  formData: FormData,
) {
  const supabase = await createClient();

  const { data: balance } = await supabase
    .from("balance_pruebas")
    .select("id")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!balance) return;

  // Recolectar ajustes por cuenta del FormData (d_<cuenta>, c_<cuenta>, o_<cuenta>)
  const updates = new Map<
    string,
    { ajuste_debito: number; ajuste_credito: number; observacion: string | null }
  >();
  for (const [k, raw] of formData.entries()) {
    const v = String(raw ?? "");
    if (k.startsWith("d_")) {
      const cuenta = k.slice(2);
      const prev = updates.get(cuenta) ?? {
        ajuste_debito: 0,
        ajuste_credito: 0,
        observacion: null,
      };
      prev.ajuste_debito = Number(v) || 0;
      updates.set(cuenta, prev);
    } else if (k.startsWith("c_")) {
      const cuenta = k.slice(2);
      const prev = updates.get(cuenta) ?? {
        ajuste_debito: 0,
        ajuste_credito: 0,
        observacion: null,
      };
      prev.ajuste_credito = Number(v) || 0;
      updates.set(cuenta, prev);
    } else if (k.startsWith("o_")) {
      const cuenta = k.slice(2);
      const prev = updates.get(cuenta) ?? {
        ajuste_debito: 0,
        ajuste_credito: 0,
        observacion: null,
      };
      prev.observacion = v || null;
      updates.set(cuenta, prev);
    }
  }

  for (const [cuenta, vals] of updates.entries()) {
    await supabase
      .from("balance_prueba_lineas")
      .update({
        ajuste_debito: vals.ajuste_debito,
        ajuste_credito: vals.ajuste_credito,
        observacion: vals.observacion,
      })
      .eq("balance_id", balance.id)
      .eq("cuenta", cuenta);
  }

  await reaggregateBalanceAction(declId, empresaId);
}

export async function reaggregateBalanceAction(declId: string, empresaId: string) {
  const supabase = await createClient();

  const { data: balance } = await supabase
    .from("balance_pruebas")
    .select("id")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!balance) return;

  const { data: lineas } = await supabase
    .from("balance_prueba_lineas")
    .select("id, cuenta, saldo, ajuste_debito, ajuste_credito")
    .eq("balance_id", balance.id);
  if (!lineas || lineas.length === 0) return;

  const candidatos = new Set<string>();
  for (const l of lineas) {
    candidatos.add(l.cuenta);
    if (l.cuenta.length >= 6) candidatos.add(l.cuenta.slice(0, 4));
    if (l.cuenta.length >= 4) candidatos.add(l.cuenta.slice(0, 2));
  }

  const { data: overrides } = await supabase
    .from("puc_overrides")
    .select("puc, renglon_110")
    .eq("empresa_id", empresaId)
    .in("puc", [...candidatos]);
  const overrideMap = new Map<string, number | null>(
    (overrides ?? []).map((o) => [o.puc, o.renglon_110]),
  );

  const { data: pucs } = await supabase
    .from("puc_accounts")
    .select("puc, renglon_110")
    .in("puc", [...candidatos]);
  const catalogMap = new Map<string, number | null>(
    (pucs ?? []).map((p) => [p.puc, p.renglon_110]),
  );

  function resolveRenglon(puc: string): number | null {
    if (overrideMap.has(puc)) return overrideMap.get(puc) ?? null;
    if (catalogMap.has(puc) && catalogMap.get(puc) != null)
      return catalogMap.get(puc) ?? null;
    if (puc.length >= 6) {
      const p4 = puc.slice(0, 4);
      if (overrideMap.has(p4)) return overrideMap.get(p4) ?? null;
      const r = catalogMap.get(p4);
      if (r != null) return r;
    }
    if (puc.length >= 4) {
      const p2 = puc.slice(0, 2);
      if (overrideMap.has(p2)) return overrideMap.get(p2) ?? null;
      const r = catalogMap.get(p2);
      if (r != null) return r;
    }
    return null;
  }

  // Update each line's renglon_110 and aggregate using SALDO FISCAL
  // (saldo contable + ajuste_debito - ajuste_credito).
  const aggByRenglon = new Map<number, number>();
  for (const l of lineas) {
    const renglon = resolveRenglon(l.cuenta);
    await supabase
      .from("balance_prueba_lineas")
      .update({ renglon_110: renglon })
      .eq("id", l.id);
    if (renglon != null && l.cuenta.length >= 6 && !RENGLONES_COMPUTADOS.has(renglon)) {
      const saldoFiscal =
        Number(l.saldo) + Number(l.ajuste_debito ?? 0) - Number(l.ajuste_credito ?? 0);
      aggByRenglon.set(renglon, (aggByRenglon.get(renglon) ?? 0) + saldoFiscal);
    }
  }

  // Replace form110_valores for this declaracion
  await supabase.from("form110_valores").delete().eq("declaracion_id", declId);
  if (aggByRenglon.size > 0) {
    const valoresPayload = [...aggByRenglon.entries()].map(([numero, valor]) => ({
      declaracion_id: declId,
      numero,
      valor: Math.round(normalizarSigno(numero, valor)),
    }));
    await supabase.from("form110_valores").insert(valoresPayload);
  }

  revalidateDeclaracion(empresaId, declId);
}

export async function saveOverridesAction(
  empresaId: string,
  declId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const overrides: { empresa_id: string; puc: string; renglon_110: number | null; nombre: string | null }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("r_")) continue;
    const puc = key.slice(2);
    const value = String(raw ?? "").trim();
    const renglon = value === "" ? null : Number(value);
    if (renglon === null || Number.isInteger(renglon)) {
      const nombreKey = "n_" + puc;
      const nombre = String(formData.get(nombreKey) ?? "") || null;
      overrides.push({ empresa_id: empresaId, puc, renglon_110: renglon, nombre });
    }
  }

  if (overrides.length === 0) return;

  await supabase
    .from("puc_overrides")
    .upsert(overrides, { onConflict: "empresa_id,puc" });

  await reaggregateBalanceAction(declId, empresaId);
}
