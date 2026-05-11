// GET /api/papel-trabajo/excel?decl={id}
//
// Genera un papel de trabajo en Excel multi-hoja con identidad Tribai
// (ink #0A1628 + gold #C4952A). Las cifras vienen 100% en vivo de la BD
// vía `loadPapelTrabajoData`.
//
// Hojas generadas:
//   01. Portada
//   02. Resumen ejecutivo
//   03. Datos contribuyente
//   04. Formulario 110
//   05. Conc utilidad
//   06. Conc patrimonial
//   07. F2516 H7 resumen
//   08. Anexos consolidados
//   09. Validaciones V1-V18
//   10. Marco normativo
//   11. Recomendaciones

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { loadPapelTrabajoData } from "@/lib/papel-trabajo-data";

const FMT_MONEY = '#,##0;(#,##0);"-"';
const INK = "0A1628";
const GOLD = "C4952A";
const GOLD_LIGHT = "FFF8E1";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const declId = url.searchParams.get("decl");
  if (!declId) {
    return NextResponse.json({ error: "Missing decl param" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[papel-trabajo/excel] auth failed:", authError?.message);
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(new URL(req.url).pathname + new URL(req.url).search)}`, req.url),
    );
  }

  let data: Awaited<ReturnType<typeof loadPapelTrabajoData>>;
  try {
    data = await loadPapelTrabajoData(supabase, declId);
  } catch (e) {
    const err = e as Error;
    console.error("[papel-trabajo/excel] loader error:", err.message, err.stack);
    return NextResponse.json(
      {
        error: "Error al cargar",
        detalle: err.message,
        stack: err.stack?.split("\n").slice(0, 8).join("\n"),
      },
      { status: 500 },
    );
  }

  let body: Uint8Array;
  try {
    const wb = XLSX.utils.book_new();
    addPortada(wb, data);
    addResumenEjecutivo(wb, data);
    addDatosContrib(wb, data);
    addForm110(wb, data);
    addConcUtilidad(wb, data);
    addConcPatrimonial(wb, data);
    addF2516(wb, data);
    addAnexos(wb, data);
    addValidaciones(wb, data);
    addMarcoNormativo(wb);
    addRecomendaciones(wb, data);

    // `type: "buffer"` devuelve un Buffer de Node.js con la firma xlsx
    // correcta (PK + ZIP). El Buffer extiende Uint8Array así que es
    // BodyInit-compatible con NextResponse.
    body = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  } catch (e) {
    const err = e as Error;
    console.error("[papel-trabajo/excel] build error:", err.message, err.stack);
    return NextResponse.json(
      {
        error: "Build failed",
        detalle: err.message,
        stack: err.stack?.split("\n").slice(0, 8).join("\n"),
      },
      { status: 500 },
    );
  }

  const filename = `Tribai_PapelTrabajo_${slug(data.empresa.razon_social)}_AG${data.declaracion.ano_gravable}.xlsx`;

  // Envolver en Blob garantiza compatibilidad con BodyInit de fetch/Response
  // sin perder los bytes del Buffer original.
  const blob = new Blob([new Uint8Array(body)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(blob, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[áàäâã]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

// ============================================================
// HELPERS DE CONSTRUCCIÓN
// ============================================================
type Cell = string | number | { v: string | number; t?: "s" | "n"; s?: object };
type Row = (Cell | null)[];

function makeSheet(rows: Row[], cols?: { wch: number }[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows as unknown as (string | number)[][]);
  if (cols) ws["!cols"] = cols;
  return ws;
}

function applyFormatToColumn(ws: XLSX.WorkSheet, col: string, format: string) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const ref = `${col}${r + 1}`;
    if (ws[ref] && typeof ws[ref].v === "number") {
      ws[ref].z = format;
    }
  }
}

// ============================================================
// HOJAS
// ============================================================
function addPortada(
  wb: XLSX.WorkBook,
  d: Awaited<ReturnType<typeof loadPapelTrabajoData>>,
) {
  const hoy = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  });
  const rows: Row[] = [
    ["tribai.co"],
    ["El Estatuto, la calculadora y el criterio. Todo en uno."],
    [],
    ["PAPEL DE TRABAJO"],
    ["Declaración de Renta y Complementarios · Formulario 110"],
    [],
    ["Contribuyente", d.empresa.razon_social],
    ["NIT", `${d.empresa.nit}${d.empresa.dv ? "-" + d.empresa.dv : ""}`],
    ["Régimen", d.empresa.regimen_codigo ?? "01"],
    ["Año gravable", d.declaracion.ano_gravable],
    ["Estado", d.declaracion.estado],
    ["Generado", hoy],
    [],
    ["DOCUMENTO DE TRABAJO · NO OFICIAL · VALIDAR EN MUISCA ANTES DE PRESENTAR"],
    [],
    ["© 2026 INPLUX SAS · NIT 901.784.448-8 · Marca Tribai"],
  ];
  const ws = makeSheet(rows, [{ wch: 30 }, { wch: 60 }]);
  XLSX.utils.book_append_sheet(wb, ws, "01 Portada");
}

function addResumenEjecutivo(
  wb: XLSX.WorkBook,
  d: Awaited<ReturnType<typeof loadPapelTrabajoData>>,
) {
  const v = (n: number) => d.valoresF110.get(n) ?? 0;
  const rows: Row[] = [
    ["RESUMEN EJECUTIVO"],
    [],
    ["KPI", "Valor", "Renglón F110"],
    ["Patrimonio líquido", v(46), "R46"],
    ["Renta líquida gravable", v(79), "R79"],
    ["Impuesto a cargo", v(99), "R99"],
    ["Saldo a pagar", v(113), "R113"],
    ["Saldo a favor", v(114), "R114"],
    [],
    ["VALIDACIONES CRUZADAS"],
    ["Total reglas", d.validaciones.length],
    ["Errores", d.resumenValidaciones.errores],
    ["Advertencias", d.resumenValidaciones.advertencias],
    ["Bloqueante", d.resumenValidaciones.bloqueante ? "SÍ" : "NO"],
  ];
  const ws = makeSheet(rows, [{ wch: 36 }, { wch: 20 }, { wch: 16 }]);
  applyFormatToColumn(ws, "B", FMT_MONEY);
  XLSX.utils.book_append_sheet(wb, ws, "02 Resumen");
}

function addDatosContrib(
  wb: XLSX.WorkBook,
  d: Awaited<ReturnType<typeof loadPapelTrabajoData>>,
) {
  const { empresa, declaracion, h1 } = d;
  const rows: Row[] = [
    ["DATOS DEL CONTRIBUYENTE"],
    [],
    ["Concepto", "Valor"],
    ["Razón social", empresa.razon_social],
    ["NIT", `${empresa.nit}${empresa.dv ? "-" + empresa.dv : ""}`],
    ["Régimen tributario", empresa.regimen_codigo ?? "01"],
    ["Código CIIU", empresa.ciiu_codigo ?? "—"],
    ["Marco normativo contable", h1?.marco_normativo ?? "NIIF Pymes"],
    [],
    ["REPRESENTANTE LEGAL"],
    ["Nombre", h1?.rep_legal_nombre ?? "—"],
    ["Documento", `${h1?.rep_legal_tipo_doc ?? "CC"} ${h1?.rep_legal_numero_doc ?? "—"}`],
    [],
    ["CONTADOR PÚBLICO"],
    ["Nombre", h1?.contador_nombre ?? "—"],
    ["Tarjeta profesional", h1?.contador_tarjeta_prof ?? "—"],
    [],
    ["REVISOR FISCAL"],
    ["¿Obligado?", h1?.obligado_revisor_fiscal ? "SÍ" : "NO"],
    ["Nombre", h1?.rf_nombre ?? "—"],
    ["Tarjeta profesional", h1?.rf_tarjeta_prof ?? "—"],
    [],
    ["DECLARACIÓN"],
    ["Año gravable", declaracion.ano_gravable],
    ["Estado", declaracion.estado],
    ["Fecha vencimiento", declaracion.fecha_vencimiento ?? "—"],
    ["Fecha presentación", declaracion.fecha_presentacion ?? "—"],
  ];
  const ws = makeSheet(rows, [{ wch: 30 }, { wch: 50 }]);
  XLSX.utils.book_append_sheet(wb, ws, "03 Datos Contribuyente");
}

function addForm110(
  wb: XLSX.WorkBook,
  d: Awaited<ReturnType<typeof loadPapelTrabajoData>>,
) {
  const v = (n: number) => d.valoresF110.get(n) ?? 0;
  const rows: Row[] = [
    ["FORMULARIO 110 · CÁLCULO COMPLETO"],
    [],
    ["#", "Concepto", "Sección", "Valor"],
  ];
  for (const r of d.renglones) {
    const val = v(r.numero);
    if (val === 0 && ![44, 46, 58, 61, 67, 72, 75, 79, 83, 91, 94, 96, 99, 113, 114].includes(r.numero)) continue;
    rows.push([r.numero, r.descripcion, r.seccion, val]);
  }
  const ws = makeSheet(rows, [
    { wch: 6 },
    { wch: 60 },
    { wch: 18 },
    { wch: 20 },
  ]);
  applyFormatToColumn(ws, "D", FMT_MONEY);
  XLSX.utils.book_append_sheet(wb, ws, "04 Formulario 110");
}

function addConcUtilidad(
  wb: XLSX.WorkBook,
  d: Awaited<ReturnType<typeof loadPapelTrabajoData>>,
) {
  const { concUtilidad, valoresF110 } = d;
  const v = (n: number) => valoresF110.get(n) ?? 0;
  const rows: Row[] = [
    ["CONCILIACIÓN DE UTILIDAD · CONTABLE → FISCAL"],
    [],
    ["ESTADO DE RESULTADOS · CONTABLE vs FISCAL"],
    ["Concepto", "Contable", "Fiscal", "Diferencia"],
  ];
  for (const f of concUtilidad.filasPyG) {
    rows.push([f.concepto, f.contable, f.fiscal, f.diferencia]);
  }
  rows.push([]);
  rows.push(["PARTIDAS DE CONCILIACIÓN (NIC 12)"]);
  rows.push(["Concepto", "Categoría", "Subcategoría", "Origen", "Signo", "Valor"]);
  for (const p of concUtilidad.partidas) {
    rows.push([
      p.concepto,
      p.categoria,
      p.subcategoria ?? "—",
      p.origen,
      p.signo,
      p.valor,
    ]);
  }
  rows.push([]);
  rows.push(["CÓMPUTO FINAL"]);
  rows.push(["Utilidad contable", concUtilidad.utilidadContableTotal]);
  rows.push(["(+) Temporarias deducibles", concUtilidad.subtotales.temporariasDeducibles]);
  rows.push(["(−) Temporarias imponibles", -concUtilidad.subtotales.temporariasImponibles]);
  rows.push(["(±) Permanentes", concUtilidad.subtotales.permanentes]);
  rows.push(["Renta líquida fiscal calculada", concUtilidad.rentaLiquidaCalculada]);
  rows.push(["R72 F110 · cuadre", v(72)]);
  rows.push(["R75 F110 · cuadre", v(75)]);
  rows.push(["R79 F110 · cuadre", v(79)]);
  rows.push(["Estado", concUtilidad.estado]);

  const ws = makeSheet(rows, [
    { wch: 50 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
  ]);
  applyFormatToColumn(ws, "B", FMT_MONEY);
  applyFormatToColumn(ws, "C", FMT_MONEY);
  applyFormatToColumn(ws, "D", FMT_MONEY);
  applyFormatToColumn(ws, "F", FMT_MONEY);
  XLSX.utils.book_append_sheet(wb, ws, "05 Conc Utilidad");
}

function addConcPatrimonial(
  wb: XLSX.WorkBook,
  d: Awaited<ReturnType<typeof loadPapelTrabajoData>>,
) {
  const r = d.concPatrimonial;
  const rows: Row[] = [
    ["CONCILIACIÓN PATRIMONIAL · ART. 236 E.T."],
    [],
    ["Modelo Aries (actualicese.com)"],
    [],
    ["VARIACIÓN PATRIMONIAL"],
    ["PL fiscal año anterior", r.plAnterior],
    ["PL fiscal año actual (R46)", r.plActual],
    ["Variación bruta", r.variacionBruta],
    [],
    ["JUSTIFICANTES (suman al PL justificado)"],
    ["Concepto", "Valor", "Origen"],
  ];
  for (const j of r.justificantes) {
    rows.push([j.label, j.valor, j.origen]);
  }
  rows.push(["Total justificantes", r.totalJustificantes]);
  rows.push([]);
  rows.push(["RESTADORES (NO justifican)"]);
  rows.push(["Concepto", "Valor", "Origen"]);
  for (const j of r.restadores) {
    rows.push([j.label, -j.valor, j.origen]);
  }
  rows.push(["Total restadores", -r.totalRestadores]);
  rows.push([]);
  rows.push(["CÓMPUTO FINAL"]);
  rows.push(["PL justificado", r.plJustificado]);
  rows.push(["PL declarado (R46)", r.plActual]);
  rows.push(["Diferencia por justificar", r.diferenciaPorJustificar]);
  rows.push(["Renta por comparación patrimonial", r.rentaPorComparacion]);
  rows.push(["Estado", r.estado]);

  const ws = makeSheet(rows, [{ wch: 50 }, { wch: 20 }, { wch: 16 }]);
  applyFormatToColumn(ws, "B", FMT_MONEY);
  XLSX.utils.book_append_sheet(wb, ws, "06 Conc Patrimonial");
}

function addF2516(
  wb: XLSX.WorkBook,
  d: Awaited<ReturnType<typeof loadPapelTrabajoData>>,
) {
  const { h7 } = d;
  const rows: Row[] = [
    ["FORMATO 2516 · RESUMEN H7"],
    [],
    ["Resolución DIAN 71/2019"],
    [],
    ["ESF · ACTIVOS, PASIVOS, PATRIMONIO"],
    ["Concepto", "Valor fiscal"],
    ["Total activos", h7.totalActivos],
    ["Total pasivos", h7.totalPasivos],
    ["Patrimonio líquido", h7.patrimonioLiquido],
    [],
    ["ERI · RESULTADO DEL EJERCICIO"],
    ["Total ingresos", h7.totalIngresos],
    ["Total costos y gastos", h7.totalCostos],
    ["Utilidad antes de impuestos", h7.utilidadAntesImpuestos],
    ["Impuesto de renta", h7.impuestoRenta],
    ["Resultado del ejercicio", h7.resultadoEjercicio],
    [],
    ["IMPUESTO DIFERIDO NIC 12"],
    ["Total ATD", h7.totalATD],
    ["Total PTD", h7.totalPTD],
    ["Impuesto diferido neto", h7.impuestoDiferidoNeto],
    [],
    ["VALIDACIONES CRUZADAS H7"],
    ["#", "Validación", "F2516", "F110", "Diferencia", "Estado"],
  ];
  for (const c of h7.cruces) {
    rows.push([
      c.id,
      c.desc,
      c.fuente2516,
      c.fuenteF110,
      c.diferencia,
      c.ok ? "✓ OK" : "⚠ Revisar",
    ]);
  }
  const ws = makeSheet(rows, [
    { wch: 8 },
    { wch: 50 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
  ]);
  applyFormatToColumn(ws, "B", FMT_MONEY);
  applyFormatToColumn(ws, "C", FMT_MONEY);
  applyFormatToColumn(ws, "D", FMT_MONEY);
  applyFormatToColumn(ws, "E", FMT_MONEY);
  XLSX.utils.book_append_sheet(wb, ws, "07 F2516 Resumen");
}

function addAnexos(
  wb: XLSX.WorkBook,
  d: Awaited<ReturnType<typeof loadPapelTrabajoData>>,
) {
  const ctx = d.anexosCtx;
  const divTotal = Object.values(ctx.dividendos ?? {}).reduce(
    (s, n) => s + Number(n || 0),
    0,
  );
  const rows: Row[] = [
    ["ANEXOS CONSOLIDADOS"],
    [],
    ["Anexo", "Renglones F110", "Valor total"],
    ["Nómina (informativo)", "R33-R35", ctx.totalNomina + ctx.aportesSegSocial + ctx.aportesParaFiscales],
    ["Dividendos", "R49-R56", divTotal],
    ["Recuperación deducciones", "R70", ctx.totalRecuperaciones],
    ["INCRNGO", "R60", ctx.totalIncrngo],
    ["Inversiones ESAL efectuadas", "R68", ctx.totalInversionesEsalEfectuadas],
    ["Inversiones ESAL liquidadas", "R69", ctx.totalInversionesEsalLiquidadas],
    ["Compensaciones", "R74", ctx.totalCompensaciones],
    ["Rentas exentas (sin tope)", "R77", ctx.totalRentasExentas],
    ["Rentas exentas (sujetas tope 10%)", "R77", ctx.totalRentasExentasConTope],
    ["Ganancia ocasional bruta", "R80", ctx.goIngresos],
    ["Costos GO", "R81", ctx.goCostos],
    ["GO no gravada", "R82", ctx.goNoGravada],
    ["Descuentos tributarios (con tope 75%)", "R93", ctx.totalDescuentosTributarios],
    ["Autorretenciones", "R105", ctx.totalAutorretenciones],
    ["Retenciones", "R106", ctx.totalRetenciones],
  ];
  const ws = makeSheet(rows, [{ wch: 40 }, { wch: 16 }, { wch: 22 }]);
  applyFormatToColumn(ws, "C", FMT_MONEY);
  XLSX.utils.book_append_sheet(wb, ws, "08 Anexos");
}

function addValidaciones(
  wb: XLSX.WorkBook,
  d: Awaited<ReturnType<typeof loadPapelTrabajoData>>,
) {
  const rows: Row[] = [
    ["VALIDACIONES CRUZADAS"],
    [],
    ["Categoría", "Nivel", "Renglón", "Mensaje"],
  ];
  for (const v of d.validaciones) {
    rows.push([v.categoria, v.nivel, v.renglon ?? "—", v.mensaje]);
  }
  const ws = makeSheet(rows, [
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
    { wch: 90 },
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "09 Validaciones");
}

function addMarcoNormativo(wb: XLSX.WorkBook) {
  const rows: Row[] = [
    ["MARCO NORMATIVO APLICABLE"],
    [],
    ["Norma", "Aplicación"],
    ["E.T. Art. 240", "Tarifa general PJ 35% + sobretasas sectoriales"],
    ["E.T. Art. 240 par. 6", "Tasa Mínima Tributación Depurada (TTD 15%)"],
    ["E.T. Art. 235-2", "Rentas exentas · tope 10% RL (par. 5)"],
    ["E.T. Art. 147", "Compensación pérdidas fiscales · plazo 12 años"],
    ["E.T. Art. 236-238", "Conciliación patrimonial · renta por comparación"],
    ["E.T. Art. 259", "Tope 75% descuentos tributarios"],
    ["E.T. Art. 807", "Anticipo del impuesto · método más favorable"],
    ["E.T. Art. 641-644", "Sanciones por extemporaneidad y corrección"],
    ["E.T. Art. 689-3", "Beneficio de auditoría (firmeza reducida)"],
    ["Ley 2277/2022", "Renta presuntiva 0% AG 2025, tarifa GO 15%"],
    ["Resolución DIAN 71/2019", "Estructura del Formato 2516 H1-H7"],
    ["Decreto 2650/93", "Catálogo Único de Cuentas (PUC)"],
    ["NIC 12 / Sección 29 NIIF Pymes", "Impuesto diferido · diferencias temporarias"],
  ];
  const ws = makeSheet(rows, [{ wch: 28 }, { wch: 80 }]);
  XLSX.utils.book_append_sheet(wb, ws, "10 Marco Normativo");
}

function addRecomendaciones(
  wb: XLSX.WorkBook,
  d: Awaited<ReturnType<typeof loadPapelTrabajoData>>,
) {
  const rentaComp = d.concPatrimonial.rentaPorComparacion;
  const errores = d.resumenValidaciones.errores;
  const rows: Row[] = [
    ["RECOMENDACIONES DEL ASESOR"],
    [],
    ["#", "Recomendación"],
    ["1", "Validar el archivo en MUISCA antes de firmar y presentar."],
    ["2", "Documentar las decisiones profesionales sobre las partidas de conciliación."],
  ];
  let n = 3;
  if (rentaComp > 0) {
    rows.push([
      String(n++),
      `Atender la renta presunta por comparación patrimonial (${rentaComp.toLocaleString("es-CO")}). Capturar las partidas justificativas faltantes o sumar el valor a R78.`,
    ]);
  }
  rows.push([
    String(n++),
    "Conservar los soportes de todas las partidas conciliatorias por al menos 5 años (Art. 632 E.T.).",
  ]);
  rows.push([
    String(n++),
    "Revisar cumplimiento de obligaciones formales: información exógena (1011), medios magnéticos.",
  ]);
  rows.push([
    String(n++),
    "Validar el cálculo del anticipo (R108) según método más favorable Art. 807.",
  ]);
  if (errores > 0) {
    rows.push([
      String(n++),
      `Resolver los ${errores} errores reportados por las validaciones antes de presentar.`,
    ]);
  }

  rows.push([]);
  rows.push(["Tribai · El Estatuto, la calculadora y el criterio. Todo en uno."]);
  rows.push(["© 2026 INPLUX SAS · Marca Tribai · tribai.co"]);

  const ws = makeSheet(rows, [{ wch: 6 }, { wch: 100 }]);
  XLSX.utils.book_append_sheet(wb, ws, "11 Recomendaciones");
}
