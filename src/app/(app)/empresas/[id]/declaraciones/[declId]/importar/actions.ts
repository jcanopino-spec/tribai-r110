"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UploadResult = {
  error: string | null;
  filename: string | null;
  totalLineas: number;
  mapeadas: number;
  sinMapear: number;
  renglonesActualizados: number;
  sample: { cuenta: string; nombre: string | null; saldo: number; renglon: number | null }[];
};

const EMPTY: UploadResult = {
  error: null,
  filename: null,
  totalLineas: 0,
  mapeadas: 0,
  sinMapear: 0,
  renglonesActualizados: 0,
  sample: [],
};

const ACCEPTED_EXT = [".xlsx", ".xls", ".xlsm", ".csv"];

function normalizeCuenta(raw: unknown): string {
  return String(raw ?? "").replace(/[^0-9]/g, "");
}

function parseSaldo(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  // Accept "1.234.567,89" (es-CO) and "1,234,567.89" (en-US) and plain numeric
  let cleaned = s.replace(/[^0-9.,-]/g, "");
  // If both "." and "," exist: assume the last one is the decimal separator
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // es-CO: "1.234.567,89"
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // en-US: "1,234,567.89"
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    // only comma: assume es-CO decimal
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // only dot or no separator
    // could be thousands: "1.234.567" — drop dots if more than one
    if ((cleaned.match(/\./g) ?? []).length > 1) cleaned = cleaned.replace(/\./g, "");
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
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

  // Detect header row: first row that has both "cuenta" and "saldo"/"valor"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const cells = rows[i].map((c) => String(c ?? "").toLowerCase());
    const hasCuenta = cells.some((c) => c.includes("cuenta") || c === "puc" || c.includes("código"));
    const hasSaldo = cells.some((c) => c.includes("saldo") || c.includes("valor"));
    if (hasCuenta && hasSaldo) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return {
      ...EMPTY,
      error:
        "No encontré los encabezados. Asegúrate de tener una fila con 'Cuenta' y 'Saldo' (o equivalentes).",
    };
  }

  const header = rows[headerIdx].map((c) => String(c ?? "").toLowerCase());
  const cuentaCol = header.findIndex(
    (c) => c.includes("cuenta") || c === "puc" || c.includes("código"),
  );
  const saldoCol = header.findIndex((c) => c.includes("saldo") || c.includes("valor"));
  const nombreCol = header.findIndex((c) => c.includes("nombre") || c.includes("descripc"));

  // Parse data rows
  type Linea = { cuenta: string; nombre: string | null; saldo: number };
  const lineas: Linea[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const cuenta = normalizeCuenta(row[cuentaCol]);
    if (!cuenta) continue;
    const nombre = nombreCol >= 0 ? String(row[nombreCol] ?? "").trim() || null : null;
    const saldo = parseSaldo(row[saldoCol]);
    if (saldo === 0 && !nombre) continue; // skip blank rows
    lineas.push({ cuenta, nombre, saldo });
  }

  if (lineas.length === 0) {
    return { ...EMPTY, error: "El archivo no contiene filas con cuenta y saldo." };
  }

  // Lookup PUC mappings
  const uniqueCuentas = [...new Set(lineas.map((l) => l.cuenta))];
  const { data: pucs } = await supabase
    .from("puc_accounts")
    .select("puc, renglon_110")
    .in("puc", uniqueCuentas);
  const renglonByPuc = new Map<string, number | null>(
    (pucs ?? []).map((p) => [p.puc, p.renglon_110]),
  );

  // Replace any prior balance for this declaracion
  await supabase.from("balance_pruebas").delete().eq("declaracion_id", declId);

  const { data: balance, error: balErr } = await supabase
    .from("balance_pruebas")
    .insert({ declaracion_id: declId, filename: file.name })
    .select("id")
    .single();
  if (balErr) return { ...EMPTY, error: balErr.message };

  // Insert lineas (chunked)
  const lineasPayload = lineas.map((l) => ({
    balance_id: balance.id,
    cuenta: l.cuenta,
    nombre: l.nombre,
    saldo: l.saldo,
    renglon_110: renglonByPuc.get(l.cuenta) ?? null,
  }));
  for (let i = 0; i < lineasPayload.length; i += 500) {
    const chunk = lineasPayload.slice(i, i + 500);
    const { error } = await supabase.from("balance_prueba_lineas").insert(chunk);
    if (error) return { ...EMPTY, error: `Error guardando líneas: ${error.message}` };
  }

  // Aggregate by renglón. Para evitar contar dos veces (cuentas a varios niveles),
  // solo aportamos al agregado las cuentas auxiliares (6 dígitos). Las cuentas
  // de mayor (2/4 dígitos) se ignoran porque su saldo ya está en sus auxiliares.
  const aggByRenglon = new Map<number, number>();
  let mapeadas = 0;
  for (const l of lineasPayload) {
    const isAux = l.cuenta.length >= 6;
    if (l.renglon_110 != null) mapeadas++;
    if (l.renglon_110 != null && isAux) {
      aggByRenglon.set(l.renglon_110, (aggByRenglon.get(l.renglon_110) ?? 0) + Number(l.saldo));
    }
  }

  let renglonesActualizados = 0;
  if (aggByRenglon.size > 0) {
    const valoresPayload = [...aggByRenglon.entries()].map(([numero, valor]) => ({
      declaracion_id: declId,
      numero,
      valor: Math.round(valor),
    }));
    const { error } = await supabase
      .from("form110_valores")
      .upsert(valoresPayload, { onConflict: "declaracion_id,numero" });
    if (error) return { ...EMPTY, error: `Error guardando valores: ${error.message}` };
    renglonesActualizados = valoresPayload.length;
  }

  // Mark modo_carga = 'balance' and bump updated_at
  await supabase
    .from("declaraciones")
    .update({ modo_carga: "balance", updated_at: new Date().toISOString() })
    .eq("id", declId);

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}/importar`);

  return {
    error: null,
    filename: file.name,
    totalLineas: lineas.length,
    mapeadas,
    sinMapear: lineas.length - mapeadas,
    renglonesActualizados,
    sample: lineasPayload.slice(0, 8).map((l) => ({
      cuenta: l.cuenta,
      nombre: l.nombre,
      saldo: Number(l.saldo),
      renglon: l.renglon_110,
    })),
  };
}
