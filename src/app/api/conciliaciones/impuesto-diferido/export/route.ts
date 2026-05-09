// Excel export del Impuesto Diferido (NIC 12 / Sección 29 NIIF Pymes).
// Genera un .xlsx con 1 hoja:
//   "Impuesto Diferido" · 16 filas (9 activos + 7 pasivos) + 2 subtotales
//   + 3 filas de resumen (Total ID-A, Total ID-P, Gasto/Ingreso neto)

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { evaluarPresentacion, ultimoDigitoNit } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";
import { loadF2516Aggregates } from "@/lib/f2516-aggregates";
import {
  ID_CATEGORIAS,
  TARIFA_ID_DEFAULT,
  calcularFilaID,
  resumenID,
  categorizarPucPasivosID,
} from "@/engine/impuesto-diferido";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const declId = url.searchParams.get("decl");
  if (!declId) {
    return NextResponse.json({ error: "Missing decl param" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("*")
    .eq("id", declId)
    .single();
  if (!declaracion) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, razon_social, nit, dv, regimen_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) return NextResponse.json({ error: "Empresa not found" }, { status: 404 });

  let tarifaRegimen: number | null = null;
  if (empresa.regimen_codigo) {
    const { data: reg } = await supabase
      .from("regimenes_tarifas")
      .select("tarifa")
      .eq("codigo", empresa.regimen_codigo)
      .eq("ano_gravable", declaracion.ano_gravable)
      .maybeSingle();
    tarifaRegimen = reg ? Number(reg.tarifa) : null;
  }
  const tarifaID = tarifaRegimen && tarifaRegimen > 0 ? tarifaRegimen : TARIFA_ID_DEFAULT;

  const { data: uvtRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable + 1)
    .eq("codigo", "uvt")
    .maybeSingle();
  const uvtVigente = uvtRow ? Number(uvtRow.valor) : null;

  const tipoContribuyente = declaracion.es_gran_contribuyente
    ? "gran_contribuyente"
    : "persona_juridica";
  const digito = ultimoDigitoNit(empresa.nit);
  let vencimientoSugerido: string | null = null;
  if (digito !== null) {
    const { data: venc } = await supabase
      .from("vencimientos_form110")
      .select("fecha_vencimiento")
      .eq("ano_gravable", declaracion.ano_gravable)
      .eq("tipo_contribuyente", tipoContribuyente)
      .eq("ultimo_digito", digito)
      .maybeSingle();
    vencimientoSugerido = venc?.fecha_vencimiento ?? null;
  }
  const evaluacion = evaluarPresentacion(
    declaracion.fecha_vencimiento ?? vencimientoSugerido,
    declaracion.fecha_presentacion,
  );

  const plAnt =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);

  const [{ data: valores }, anexosCtx, ttdInputs] = await Promise.all([
    supabase.from("form110_valores").select("numero, valor").eq("declaracion_id", declId),
    loadAnexosCtx(supabase, declId, declaracion),
    loadTasaMinimaInputs(supabase, declId, declaracion),
  ]);

  const inputs = new Map<number, number>();
  for (const v of valores ?? []) {
    inputs.set(v.numero, normalizarSigno(v.numero, Number(v.valor)));
  }
  const numerico = computarRenglones(inputs, {
    ...anexosCtx,
    tarifaRegimen: tarifaRegimen ?? undefined,
    impuestoNetoAnterior: Number(declaracion.impuesto_neto_anterior ?? 0),
    aniosDeclarando: declaracion.anios_declarando as
      | "primero" | "segundo" | "tercero_o_mas" | undefined,
    presentacion:
      evaluacion.estado === "extemporanea"
        ? { estado: "extemporanea", mesesExtemporanea: evaluacion.mesesExtemporanea }
        : evaluacion.estado === "oportuna"
          ? { estado: "oportuna" }
          : { estado: "no_presentada" },
    aplicaTasaMinima:
      aplicaTTDPorRegimen(empresa.regimen_codigo).aplica &&
      (declaracion.aplica_tasa_minima ?? true),
    utilidadContableNeta: ttdInputs.utilidadContableNeta,
    difPermanentesAumentan: ttdInputs.difPermanentesAumentan,
    uvtVigente: uvtVigente ?? undefined,
    patrimonioLiquidoAnterior: plAnt,
    esInstitucionFinanciera: !!declaracion.es_institucion_financiera,
  });

  // Activos vía F2516
  const f2516Filas = await loadF2516Aggregates(supabase, declId, numerico);
  const f2516Map = new Map(f2516Filas.map((f) => [f.fila.id, f]));

  // Pasivos vía subprefijo PUC del balance
  const pasivosBases = new Map<string, { contable: number; fiscal: number }>();
  const { data: balance } = await supabase
    .from("balance_pruebas")
    .select("id")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (balance) {
    const { data: lineas } = await supabase
      .from("balance_prueba_lineas")
      .select("cuenta, saldo, ajuste_debito, ajuste_credito")
      .eq("balance_id", balance.id);

    // Filtro anti-duplicación · solo cuentas hoja (sin hijas presentes)
    const todas = new Set<string>();
    for (const l of lineas ?? []) {
      const c = String(l.cuenta).replace(/[^0-9]/g, "");
      if (c) todas.add(c);
    }
    const tieneHijas = (cuenta: string): boolean => {
      for (const otra of todas) {
        if (otra.length > cuenta.length && otra.startsWith(cuenta)) return true;
      }
      return false;
    };

    for (const l of lineas ?? []) {
      const cuentaNum = String(l.cuenta).replace(/[^0-9]/g, "");
      if (!cuentaNum) continue;
      const catId = categorizarPucPasivosID(cuentaNum);
      if (!catId) continue;
      if (tieneHijas(cuentaNum)) continue;
      const c = Math.abs(Number(l.saldo));
      const f = Math.abs(
        Number(l.saldo) + Number(l.ajuste_debito) - Number(l.ajuste_credito),
      );
      const prev = pasivosBases.get(catId) ?? { contable: 0, fiscal: 0 };
      pasivosBases.set(catId, { contable: prev.contable + c, fiscal: prev.fiscal + f });
    }
  }

  const filasID = ID_CATEGORIAS.map((cat) => {
    let baseContable = 0;
    let baseFiscal = 0;
    if (cat.tipo === "activo" && cat.f2516FilaId) {
      const f = f2516Map.get(cat.f2516FilaId);
      if (f) {
        baseContable = f.contable;
        baseFiscal = f.fiscal;
      }
    } else if (cat.tipo === "pasivo") {
      const b = pasivosBases.get(cat.id);
      if (b) {
        baseContable = b.contable;
        baseFiscal = b.fiscal;
      }
    }
    return calcularFilaID({ categoria: cat, baseContable, baseFiscal, tarifa: tarifaID });
  });
  const resumen = resumenID(filasID);
  const activos = filasID.filter((f) => f.categoria.tipo === "activo");
  const pasivos = filasID.filter((f) => f.categoria.tipo === "pasivo");

  const razonSocial = empresa.razon_social;
  const nitEmpresa = empresa.nit
    ? `${empresa.nit}${empresa.dv ? `-${empresa.dv}` : ""}`
    : "—";

  type Cell = string | number;
  const data: Cell[][] = [
    [`Impuesto Diferido · ${razonSocial} (NIT ${nitEmpresa})`],
    [`Año gravable ${declaracion.ano_gravable} · Tarifa aplicada ${(tarifaID * 100).toFixed(0)}%`],
    [`Generado ${new Date().toLocaleString("es-CO")}`],
    [
      "Fórmulas: DEDUCIBLE = (FISCAL>CONTABLE en activos · CONTABLE>FISCAL en pasivos)",
    ],
    [
      "ID Activo = ROUND(deducible × tarifa, -3)  ·  ID Pasivo = ROUND(imponible × tarifa, -3)",
    ],
    [],
    ["ACTIVOS · diferencias temporarias"],
    [
      "#",
      "Concepto",
      "Base Contable",
      "Base Fiscal",
      "Dif. Deducible",
      "Dif. Imponible",
      "ID Activo",
      "ID Pasivo",
    ],
  ];

  for (const f of activos) {
    data.push([
      f.categoria.numero,
      f.categoria.label,
      f.baseContable,
      f.baseFiscal,
      f.difDeducible,
      f.difImponible,
      f.idActivo,
      f.idPasivo,
    ]);
  }
  data.push([
    "",
    "SUBTOTAL ACTIVOS",
    activos.reduce((s, f) => s + f.baseContable, 0),
    activos.reduce((s, f) => s + f.baseFiscal, 0),
    activos.reduce((s, f) => s + f.difDeducible, 0),
    activos.reduce((s, f) => s + f.difImponible, 0),
    activos.reduce((s, f) => s + f.idActivo, 0),
    activos.reduce((s, f) => s + f.idPasivo, 0),
  ]);
  data.push([]);
  data.push(["PASIVOS · diferencias temporarias"]);
  data.push([
    "#",
    "Concepto",
    "Base Contable",
    "Base Fiscal",
    "Dif. Deducible",
    "Dif. Imponible",
    "ID Activo",
    "ID Pasivo",
  ]);
  for (const f of pasivos) {
    data.push([
      f.categoria.numero,
      f.categoria.label,
      f.baseContable,
      f.baseFiscal,
      f.difDeducible,
      f.difImponible,
      f.idActivo,
      f.idPasivo,
    ]);
  }
  data.push([
    "",
    "SUBTOTAL PASIVOS",
    pasivos.reduce((s, f) => s + f.baseContable, 0),
    pasivos.reduce((s, f) => s + f.baseFiscal, 0),
    pasivos.reduce((s, f) => s + f.difDeducible, 0),
    pasivos.reduce((s, f) => s + f.difImponible, 0),
    pasivos.reduce((s, f) => s + f.idActivo, 0),
    pasivos.reduce((s, f) => s + f.idPasivo, 0),
  ]);
  data.push([]);
  data.push(["RESUMEN"]);
  data.push(["", "TOTAL ACTIVO POR IMPUESTO DIFERIDO", "", "", "", "", resumen.totalActivoID, ""]);
  data.push(["", "TOTAL PASIVO POR IMPUESTO DIFERIDO", "", "", "", "", "", resumen.totalPasivoID]);
  data.push([
    "",
    resumen.gastoIngresoNeto >= 0 ? "GASTO POR ID NETO" : "INGRESO POR ID NETO",
    "",
    "",
    "",
    "",
    "",
    Math.abs(resumen.gastoIngresoNeto),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 4 },
    { wch: 36 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Impuesto Diferido");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safe = razonSocial
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30);
  const filename = `id_${safe}_AG${declaracion.ano_gravable}_${dateStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
