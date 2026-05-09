// Excel export del Formato 2516 v.9 (Resolución DIAN 71/2019).
// Genera un .xlsx con 2 hojas:
//   1) Conciliación · las 18 filas con 5 columnas + cuadre F110
//   2) Detalle balance · cuentas PUC clasificadas a cada fila del F2516
//
// Útil para que el contador valide ofuera del producto y/o lo entregue
// a la firma de auditoría.

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
import { categorizarPucF2516, F2516_FILAS } from "@/engine/f2516";

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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("*")
    .eq("id", declId)
    .single();
  if (!declaracion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, razon_social, nit, dv, regimen_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) {
    return NextResponse.json({ error: "Empresa not found" }, { status: 404 });
  }

  // ============================================================
  // Compute F110 para alimentar la columna "F110" del F2516
  // ============================================================
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

  const { data: tarifaRpRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable)
    .eq("codigo", "tarifa_renta_presuntiva")
    .maybeSingle();
  const tarifaRP = tarifaRpRow ? Number(tarifaRpRow.valor) : 0;
  const plAnt =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);
  const depRP =
    Number(declaracion.rp_acciones_sociedades_nacionales ?? 0) +
    Number(declaracion.rp_bienes_actividades_improductivas ?? 0) +
    Number(declaracion.rp_bienes_fuerza_mayor ?? 0) +
    Number(declaracion.rp_bienes_periodo_improductivo ?? 0) +
    Number(declaracion.rp_bienes_mineria ?? 0) +
    Number(declaracion.rp_primeros_19000_uvt_vivienda ?? 0);
  const rentaPresuntiva =
    Math.max(0, plAnt - depRP) * tarifaRP +
    Number(declaracion.rp_renta_gravada_bienes_excluidos ?? 0);

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
    calculaSancionExtemporaneidad: !!declaracion.calcula_sancion_extemporaneidad,
    aplicaTasaMinima:
      aplicaTTDPorRegimen(empresa.regimen_codigo).aplica &&
      (declaracion.aplica_tasa_minima ?? true),
    utilidadContableNeta: ttdInputs.utilidadContableNeta,
    difPermanentesAumentan: ttdInputs.difPermanentesAumentan,
    calculaSancionCorreccion: !!declaracion.calcula_sancion_correccion,
    mayorValorCorreccion: Number(declaracion.mayor_valor_correccion ?? 0),
    existeEmplazamiento: !!declaracion.existe_emplazamiento,
    reduccionSancion: (declaracion.reduccion_sancion ?? "0") as "0" | "50" | "75",
    uvtVigente: uvtVigente ?? undefined,
    patrimonioLiquidoAnterior: plAnt,
    esInstitucionFinanciera: !!declaracion.es_institucion_financiera,
    rentaPresuntiva,
  });

  const filas = await loadF2516Aggregates(supabase, declId, numerico);

  const razonSocial = empresa.razon_social;
  const nitEmpresa = empresa.nit
    ? `${empresa.nit}${empresa.dv ? `-${empresa.dv}` : ""}`
    : "—";

  // ============================================================
  // Hoja 1 · Conciliación
  // ============================================================
  type Cell = string | number;
  const conciliacionData: Cell[][] = [
    [`Formato 2516 · ${razonSocial} (NIT ${nitEmpresa})`],
    [`Año gravable ${declaracion.ano_gravable}`],
    [`Generado ${new Date().toLocaleString("es-CO")}`],
    [`Fórmula: FISCAL = CONTABLE + CONVERSIÓN − MENOR FISCAL + MAYOR FISCAL`],
    [],
    [
      "#",
      "Sección",
      "Concepto",
      "Contable",
      "Conversión",
      "Menor Fiscal",
      "Mayor Fiscal",
      "Fiscal",
      "F110 Renglón",
      "F110 Valor",
      "Δ (Fiscal − F110)",
      "Observación",
    ],
  ];

  for (const f of filas) {
    conciliacionData.push([
      f.fila.numero,
      f.fila.seccion,
      f.fila.label + (f.fila.esTotal ? " (total)" : ""),
      f.contable,
      f.fila.esTotal ? "" : f.conversion,
      f.fila.esTotal ? "" : f.menorFiscal,
      f.fila.esTotal ? "" : f.mayorFiscal,
      f.fiscal,
      f.fila.cuadraConR110 ? `R${f.fila.cuadraConR110}` : "",
      f.r110 !== null ? f.r110 : "",
      f.diferencia !== null ? f.diferencia : "",
      f.observacion ?? "",
    ]);
  }

  const wsConciliacion = XLSX.utils.aoa_to_sheet(conciliacionData);
  wsConciliacion["!cols"] = [
    { wch: 4 },   // #
    { wch: 18 },  // Sección
    { wch: 36 },  // Concepto
    { wch: 16 },  // Contable
    { wch: 14 },  // Conversión
    { wch: 14 },  // Menor F.
    { wch: 14 },  // Mayor F.
    { wch: 16 },  // Fiscal
    { wch: 12 },  // F110 Renglón
    { wch: 16 },  // F110 Valor
    { wch: 14 },  // Delta
    { wch: 40 },  // Observación
  ];

  // ============================================================
  // Hoja 2 · Detalle balance (cuentas PUC clasificadas)
  // ============================================================
  const { data: balance } = await supabase
    .from("balance_pruebas")
    .select("id")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const detalleData: Cell[][] = [
    [`Detalle del balance clasificado por F2516 · AG ${declaracion.ano_gravable}`],
    [],
    [
      "Cuenta PUC",
      "Nombre",
      "Saldo",
      "Ajuste Débito",
      "Ajuste Crédito",
      "Saldo Neto",
      "F2516 Fila",
      "F2516 Concepto",
    ],
  ];

  if (balance) {
    const { data: lineas } = await supabase
      .from("balance_prueba_lineas")
      .select("cuenta, nombre, saldo, ajuste_debito, ajuste_credito")
      .eq("balance_id", balance.id)
      .order("cuenta");

    for (const l of lineas ?? []) {
      const filaId = categorizarPucF2516(l.cuenta);
      const meta = filaId
        ? F2516_FILAS.find((x) => x.id === filaId)
        : null;
      const neto =
        Number(l.saldo) + Number(l.ajuste_debito) - Number(l.ajuste_credito);
      detalleData.push([
        l.cuenta,
        l.nombre ?? "",
        Number(l.saldo),
        Number(l.ajuste_debito),
        Number(l.ajuste_credito),
        neto,
        meta ? `${meta.numero}` : "—",
        meta ? meta.label : "(sin clasificar)",
      ]);
    }
  } else {
    detalleData.push(["(no hay balance cargado)", "", "", "", "", "", "", ""]);
  }

  const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
  wsDetalle["!cols"] = [
    { wch: 10 }, // PUC
    { wch: 40 }, // Nombre
    { wch: 16 }, // Saldo
    { wch: 14 }, // Aj DB
    { wch: 14 }, // Aj CR
    { wch: 16 }, // Neto
    { wch: 10 }, // Fila
    { wch: 28 }, // Concepto
  ];

  // ============================================================
  // Workbook
  // ============================================================
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsConciliacion, "Formato 2516");
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle PUC");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safe = razonSocial
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30);
  const filename = `f2516_${safe}_AG${declaracion.ano_gravable}_${dateStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
