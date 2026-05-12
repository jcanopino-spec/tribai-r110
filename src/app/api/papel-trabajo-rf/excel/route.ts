// GET /api/papel-trabajo-rf/excel?decl={id}
//
// Papel de Trabajo para Revisoría Fiscal · estructura inspirada en
// modelo110.xlsm oficial DIAN. 25 hojas conectadas por fórmulas SUMIFS
// cross-sheet. Hoja Sumaria como pivote central.
//
// Flujo: Balance → Hoja Sumaria → H2/H3/H4-H7 → Σ totalizadores
//                                              ↘
//                                        Anexos / Conciliaciones
//                                              ↓
//                                  Liquidación Privada → Formulario 110

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { loadPapelTrabajoRFData, type PapelTrabajoRFData } from "@/lib/papel-trabajo-rf-data";

// Identidad visual DIAN + Tribai
const DIAN_BLUE = "FF1B5AAB";
const DIAN_BLUE_LIGHT = "FFE8F1FA";
const DIAN_BLUE_DEEP = "FF103E7B";
const TRIBAI_INK = "FF0A1628";
const TRIBAI_GOLD = "FFC4952A";
const TRIBAI_GOLD_LIGHT = "FFFFF8E1";
const WHITE = "FFFFFFFF";
const GREY_BORDER = "FFCCCCCC";
const BLACK = "FF000000";
const FMT_MONEY = '"$"#,##0;[Red]"($"#,##0")";"-"';
const FMT_PCT = "0.00%";

// Nombres exactos de hoja (referenciados en fórmulas) · alineados al modelo guía DIAN modelo110.xlsm
const SHEET = {
  PORTADA: "PRESENTACIÓN",
  DATOS_BASICOS: "Datos Básicos",
  DATOS_INF: "Datos Informativos",
  BALANCE: "Balance de Prueba",
  SUMARIA: "Hoja Sumaria",
  IMP_DIF: "Impuesto Diferido",
  LIQUID: "Liquidacion Privada",
  S_PATR: "Σ Patrimonio",
  S_ING: "Σ Ingresos",
  S_COSTOS: "Σ Costos y Deducciones",
  S_RENTA: "Σ Renta",
  AX_RP: "Anexo 1 Renta Presuntiva",
  AX_RET: "Anexo 3 Retenciones y Auto",
  AX_AF: "Anexo 5 Venta AF",
  AX_CONCI_PATR: "Anexo 16 Conci Patr",
  AX_CONCI_UTIL: "Anexo 17 Conci Utilidad",
  AX_PERDIDAS: "Anexo 20 Comp Pérdidas",
  AX_NOMINA: "Anexo 21 Pagos Seg. Social",
  TASA_MIN: "Tasa Mínima - TTD",
  FORM110: "Formulario 110",
  H1: "H1 (Caratula)",
  H2: "H2 (ESF - Patrimonio)",
  H3: "H3 (ERI - Renta Liquida)",
  H4: "H4 (Impuesto Diferido)",
  H5: "H5 (Ingresos y Facturación)",
  H6: "H6 (Activos fijos)",
  H7: "H7 (Resumen ESF-ERI)",
  F110_2516: "F110_2516",
  F110_CONCI: "F110_Conciliación",
  AUDI_F110: "Audi_F-110",
  AUDIT_RF: "Auditoría_F-110",
} as const;

// =========================================================================
// MAIN
// =========================================================================
export async function GET(req: Request) {
  const url = new URL(req.url);
  const declId = url.searchParams.get("decl");
  if (!declId) {
    return NextResponse.json({ error: "Missing decl param" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(url.pathname + url.search)}`, req.url));
  }

  let data: PapelTrabajoRFData;
  try {
    data = await loadPapelTrabajoRFData(supabase, declId);
  } catch (e) {
    return NextResponse.json({ error: "Load failed", detalle: (e as Error).message }, { status: 500 });
  }

  let arrayBuf: ArrayBuffer;
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Tribai · El Estatuto, la calculadora y el criterio.";
    wb.created = new Date();
    wb.title = `Papel de Trabajo RF · ${data.empresa.razon_social}`;
    wb.subject = `Declaración de renta AG ${data.declaracion.ano_gravable}`;
    wb.description = "Anexo para auditoría de Revisoría Fiscal · arquitectura modelo guía DIAN.";

    // Orden alineado al modelo guía DIAN modelo110.xlsm
    addPortada(wb, data);
    addDatosBasicos(wb, data);
    addDatosInformativos(wb, data);
    addBalancePrueba(wb, data);
    addHojaSumaria(wb, data);
    addImpuestoDiferido(wb, data);
    addLiquidacionPrivada(wb, data);
    addSigmaPatrimonio(wb, data);
    addSigmaIngresos(wb, data);
    addSigmaCostos(wb, data);
    addSigmaRenta(wb, data);
    addAnxRentaPresuntiva(wb, data);
    addAnxRetenciones(wb, data);
    addAnxActivosFijos(wb, data);
    addAnxConciPatr(wb, data);
    addAnxConciUtil(wb, data);
    addAnxPerdidasFisc(wb, data);
    addAnxNominaSS(wb, data);
    addTasaMinima(wb, data);
    addFormulario110(wb, data);
    addH1Caratula(wb, data);
    addH2ESF(wb, data);
    addH3ERI(wb, data);
    addH4ImpDif(wb, data);
    addH5Ingresos(wb, data);
    addH6ActivosFijos(wb, data);
    addH7Resumen(wb, data);
    addF110_2516(wb, data);
    addF110_Conciliacion(wb, data);
    addAudiF110(wb, data);
    addAuditoriaRF(wb, data);

    arrayBuf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  } catch (e) {
    const err = e as Error;
    console.error("[papel-trabajo-rf/excel] build error:", err.message, err.stack);
    return NextResponse.json(
      { error: "Build failed", detalle: err.message, stack: err.stack?.split("\n").slice(0, 8).join("\n") },
      { status: 500 },
    );
  }

  const head = new Uint8Array(arrayBuf, 0, 4);
  if (head[0] !== 0x50 || head[1] !== 0x4b || head[2] !== 0x03 || head[3] !== 0x04) {
    return NextResponse.json({ error: "Binario corrupto" }, { status: 500 });
  }

  const filename = `Tribai_PapelTrabajoRF_${slug(data.empresa.razon_social)}_AG${data.declaracion.ano_gravable}.xlsx`;
  return new NextResponse(arrayBuf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

function slug(s: string): string {
  return s.toLowerCase()
    .replace(/[áàäâã]/g, "a").replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i").replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_")
    .replace(/^_|_$/g, "").toUpperCase();
}

// =========================================================================
// HELPERS DE ESTILO
// =========================================================================
type Sty = Partial<ExcelJS.Style>;

function bordersAll(color: string = GREY_BORDER): Sty["border"] {
  const s: ExcelJS.BorderStyle = "thin";
  return {
    top: { style: s, color: { argb: color } },
    bottom: { style: s, color: { argb: color } },
    left: { style: s, color: { argb: color } },
    right: { style: s, color: { argb: color } },
  };
}

function styBannerDIAN(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: DIAN_BLUE } },
    font: { bold: true, color: { argb: WHITE }, size: 14, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "center" },
    border: bordersAll(BLACK),
  };
}

function stySubBanner(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: DIAN_BLUE_LIGHT } },
    font: { italic: true, color: { argb: DIAN_BLUE_DEEP }, size: 10, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "center" },
  };
}

function styBannerTribai(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: TRIBAI_INK } },
    font: { bold: true, color: { argb: WHITE }, size: 18, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "left", indent: 1 },
  };
}

function styPill(num: string | number): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: TRIBAI_GOLD } },
    font: { bold: true, color: { argb: DIAN_BLUE_DEEP }, size: 9, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "center" },
    border: bordersAll(BLACK),
  };
}

function stySection(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: DIAN_BLUE } },
    font: { bold: true, color: { argb: WHITE }, size: 11, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "left", indent: 1 },
    border: bordersAll(BLACK),
  };
}

function styColHeader(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: DIAN_BLUE_DEEP } },
    font: { bold: true, color: { argb: WHITE }, size: 9, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    border: bordersAll(BLACK),
  };
}

function styLabel(): Sty {
  return {
    font: { color: { argb: TRIBAI_INK }, size: 10, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "left", indent: 1, wrapText: true },
    border: bordersAll(),
  };
}

function styLabelBold(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: DIAN_BLUE_LIGHT } },
    font: { bold: true, color: { argb: DIAN_BLUE_DEEP }, size: 10, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "left", indent: 1 },
    border: bordersAll(),
  };
}

function styMoney(): Sty {
  return {
    font: { color: { argb: TRIBAI_INK }, size: 10, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "right", indent: 1 },
    border: bordersAll(),
    numFmt: FMT_MONEY,
  };
}

function styMoneyTotal(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: TRIBAI_GOLD_LIGHT } },
    font: { bold: true, color: { argb: TRIBAI_INK }, size: 11, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "right", indent: 1 },
    border: bordersAll(BLACK),
    numFmt: FMT_MONEY,
  };
}

function styMoneyInput(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFDE7" } },
    font: { color: { argb: TRIBAI_INK }, size: 10, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "right", indent: 1 },
    border: bordersAll(BLACK),
    numFmt: FMT_MONEY,
  };
}

function styRenglon(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: TRIBAI_GOLD } },
    font: { bold: true, color: { argb: DIAN_BLUE_DEEP }, size: 9, name: "Consolas" },
    alignment: { vertical: "middle", horizontal: "center" },
    border: bordersAll(BLACK),
  };
}

function styNivel1(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: DIAN_BLUE } },
    font: { bold: true, color: { argb: WHITE }, size: 10, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "left", indent: 1 },
    border: bordersAll(BLACK),
  };
}

function styNivel2(): Sty {
  return {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: DIAN_BLUE_LIGHT } },
    font: { bold: true, color: { argb: DIAN_BLUE_DEEP }, size: 10, name: "Calibri" },
    alignment: { vertical: "middle", horizontal: "left", indent: 1 },
    border: bordersAll(),
  };
}

// =========================================================================
// HOJA 01 · PORTADA
// =========================================================================
function addPortada(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.PORTADA, {
    properties: { tabColor: { argb: TRIBAI_GOLD } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 28 }, { width: 38 }, { width: 28 }, { width: 28 }, { width: 3 }];

  ws.mergeCells("B2:E3");
  const b = ws.getCell("B2");
  b.value = "tribai.co · El Estatuto, la calculadora y el criterio.";
  b.style = styBannerTribai();
  ws.getRow(2).height = 28; ws.getRow(3).height = 18;

  ws.mergeCells("B5:E5");
  const t = ws.getCell("B5");
  t.value = "PAPEL DE TRABAJO · ANEXO PARA REVISORÍA FISCAL";
  t.style = styBannerDIAN();
  ws.getRow(5).height = 28;

  ws.mergeCells("B6:E6");
  const s = ws.getCell("B6");
  s.value = `Declaración de Renta y Complementarios · Formulario 110 · AG ${d.declaracion.ano_gravable}`;
  s.style = stySubBanner();

  // Identificación del contribuyente
  ws.mergeCells("B8:E8");
  ws.getCell("B8").value = "1. IDENTIFICACIÓN DEL CONTRIBUYENTE";
  ws.getCell("B8").style = stySection();
  ws.getRow(8).height = 22;

  const dianBlock: [string, string | number, string?, (string | number)?][] = [
    ["Razón social", d.empresa.razon_social, "NIT", `${d.empresa.nit}${d.empresa.dv ? "-" + d.empresa.dv : ""}`],
    ["Régimen tributario", d.empresa.regimen_codigo ?? "01", "Actividad económica (CIIU)", d.empresa.ciiu_codigo ?? "—"],
    ["Marco normativo", d.h1?.marco_normativo ?? "NIIF Pymes", "Año gravable", d.declaracion.ano_gravable],
    ["Fecha de vencimiento", d.declaracion.fecha_vencimiento ?? "—", "Fecha de presentación", d.declaracion.fecha_presentacion ?? "—"],
    ["Tarifa aplicable", d.h1?.tarifa_aplicable ?? "35%", "Estado", d.declaracion.estado ?? "borrador"],
  ];
  dianBlock.forEach((r, i) => {
    const ri = 9 + i;
    ws.getCell(`B${ri}`).value = r[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    ws.getCell(`C${ri}`).value = r[1]; ws.getCell(`C${ri}`).style = styLabel();
    if (r[2]) { ws.getCell(`D${ri}`).value = r[2]; ws.getCell(`D${ri}`).style = styLabelBold(); }
    if (r[3] !== undefined) { ws.getCell(`E${ri}`).value = r[3]; ws.getCell(`E${ri}`).style = styLabel(); }
  });

  // Resumen ejecutivo
  ws.mergeCells("B15:E15");
  ws.getCell("B15").value = "2. RESUMEN EJECUTIVO · CIFRAS CONECTADAS";
  ws.getCell("B15").style = stySection();
  ws.getRow(15).height = 22;

  const kpis: [string, string][] = [
    ["Patrimonio líquido fiscal (F-110 R46)", `='${SHEET.FORM110}'!E48`],
    ["Total ingresos brutos (F-110 R56)", `='${SHEET.FORM110}'!E58`],
    ["Renta líquida gravable (F-110 R79)", `='${SHEET.FORM110}'!E81`],
    ["Impuesto a cargo (F-110 R99)", `='${SHEET.FORM110}'!E101`],
    ["Saldo a pagar (F-110 R113)", `='${SHEET.FORM110}'!E115`],
    ["Saldo a favor (F-110 R114)", `='${SHEET.FORM110}'!E116`],
  ];
  kpis.forEach((r, i) => {
    const ri = 16 + i;
    ws.mergeCells(`B${ri}:D${ri}`);
    ws.getCell(`B${ri}`).value = r[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    ws.getCell(`E${ri}`).value = { formula: r[1].slice(1) } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = styMoneyTotal();
  });

  // Responsables
  ws.mergeCells("B23:E23");
  ws.getCell("B23").value = "3. RESPONSABLES";
  ws.getCell("B23").style = stySection();
  ws.getRow(23).height = 22;

  const resp: [string, string][] = [
    ["Representante legal", d.h1?.rep_legal_nombre ?? "—"],
    ["Documento", `${d.h1?.rep_legal_tipo_doc ?? "CC"} ${d.h1?.rep_legal_numero_doc ?? "—"}`],
    ["Contador público", d.h1?.contador_nombre ?? "—"],
    ["T.P. Contador", d.h1?.contador_tarjeta_prof ?? "—"],
    ["Revisor fiscal", d.h1?.rf_nombre ?? "—"],
    ["T.P. Revisor fiscal", d.h1?.rf_tarjeta_prof ?? "—"],
  ];
  resp.forEach((r, i) => {
    const ri = 24 + i;
    ws.mergeCells(`B${ri}:C${ri}`);
    ws.getCell(`B${ri}`).value = r[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    ws.mergeCells(`D${ri}:E${ri}`);
    ws.getCell(`D${ri}`).value = r[1]; ws.getCell(`D${ri}`).style = styLabel();
  });

  // Índice de hojas
  ws.mergeCells("B31:E31");
  ws.getCell("B31").value = "4. ÍNDICE DEL PAPEL DE TRABAJO · 31 HOJAS";
  ws.getCell("B31").style = stySection();
  ws.getRow(31).height = 22;

  const indice: string[] = [
    "PRESENTACIÓN · esta hoja",
    "Datos Básicos · empresa, NIT, régimen, dirección",
    "Datos Informativos · 22 flags MUISCA + marco normativo",
    "Balance de Prueba · saldos contables + ajustes (input)",
    "Hoja Sumaria · pivote · cuenta → R110/F2516 (formulada)",
    "Impuesto Diferido · ATD/PTD detallado (Art. 290 E.T.)",
    "Liquidacion Privada · cálculo final impuesto y saldo",
    "Σ Patrimonio / Σ Ingresos / Σ Costos / Σ Renta · totalizadores",
    "Anexo 1 Renta Presuntiva · Art. 188 E.T.",
    "Anexo 3 Retenciones y Auto · RF + autorretención + anticipo",
    "Anexo 5 Venta AF · enajenación de activos fijos",
    "Anexo 16 Conci Patr · patrimonio contable vs fiscal",
    "Anexo 17 Conci Utilidad · utilidad contable → renta fiscal",
    "Anexo 20 Comp Pérdidas · pérdidas fiscales por compensar",
    "Anexo 21 Pagos Seg. Social · aportes salud/pensión/ARL/parafiscales",
    "Tasa Mínima - TTD · Art. 240 par. 6 E.T. (Ley 2277)",
    "Formulario 110 · 88 renglones con valor (plantilla oficial)",
    "H1 a H7 · F-2516 oficial DIAN Res. 71/2019",
    "F110_2516 · cruce renglón F-110 vs F-2516 H7",
    "F110_Conciliación · cruce F-110 contable vs fiscal",
    "Audi_F-110 · checklist liviano de cuadres clave",
    "Auditoría_F-110 · checklist extenso + validaciones + firma RF",
  ];
  indice.forEach((line, i) => {
    const ri = 32 + i;
    ws.mergeCells(`B${ri}:E${ri}`);
    ws.getCell(`B${ri}`).value = line; ws.getCell(`B${ri}`).style = styLabel();
  });

  // Firma RF
  const sFi = 32 + indice.length + 2;
  ws.mergeCells(`B${sFi}:E${sFi}`);
  ws.getCell(`B${sFi}`).value = "5. FIRMA REVISORÍA FISCAL";
  ws.getCell(`B${sFi}`).style = stySection();
  ws.getRow(sFi).height = 22;
  ws.mergeCells(`B${sFi + 1}:E${sFi + 1}`);
  ws.getCell(`B${sFi + 1}`).value = "Certifico que la información contenida en este papel de trabajo se preparó conforme a las NIA (Normas Internacionales de Auditoría) y refleja la base sobre la cual se calculó la declaración de renta. Las cifras contables provienen del balance de prueba auditado; los ajustes fiscales fueron revisados uno a uno contra el Estatuto Tributario.";
  ws.getCell(`B${sFi + 1}`).style = { ...styLabel(), alignment: { vertical: "top", horizontal: "justify", wrapText: true, indent: 1 } };
  ws.getRow(sFi + 1).height = 70;
  ws.mergeCells(`B${sFi + 3}:C${sFi + 3}`);
  ws.getCell(`B${sFi + 3}`).value = "Firma RF: ____________________________";
  ws.getCell(`B${sFi + 3}`).style = styLabel();
  ws.mergeCells(`D${sFi + 3}:E${sFi + 3}`);
  ws.getCell(`D${sFi + 3}`).value = `T.P.: ${d.h1?.rf_tarjeta_prof ?? "______________"}`;
  ws.getCell(`D${sFi + 3}`).style = styLabel();
}

// =========================================================================
// HOJA 02 · DATOS BÁSICOS
// =========================================================================
function addDatosBasicos(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.DATOS_BASICOS, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 32 }, { width: 60 }, { width: 3 }];

  ws.mergeCells("B2:C2");
  ws.getCell("B2").value = "DATOS BÁSICOS DEL CONTRIBUYENTE";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  const filas: [string, string | number][] = [
    ["Razón social", d.empresa.razon_social],
    ["NIT", d.empresa.nit],
    ["Dígito de verificación", d.empresa.dv ?? "—"],
    ["Régimen tributario", d.empresa.regimen_codigo ?? "01"],
    ["Código CIIU", d.empresa.ciiu_codigo ?? "—"],
    ["Dirección de notificación", d.h1?.direccion_notificacion ?? "—"],
    ["Departamento", d.h1?.departamento_codigo ?? "—"],
    ["Municipio", d.h1?.municipio_codigo ?? "—"],
    ["Teléfono", d.h1?.telefono ?? "—"],
    ["Correo electrónico", d.h1?.correo ?? "—"],
    ["Año gravable", d.declaracion.ano_gravable],
    ["Gran contribuyente", d.declaracion.es_gran_contribuyente ? "Sí" : "No"],
    ["Institución financiera", d.declaracion.es_institucion_financiera ? "Sí" : "No"],
    ["Años declarando", d.declaracion.anios_declarando ?? "tercero_o_mas"],
    ["Fecha de vencimiento", d.declaracion.fecha_vencimiento ?? "—"],
    ["Fecha de presentación", d.declaracion.fecha_presentacion ?? "—"],
    ["UVT vigente (siguiente AG)", d.uvtVigente],
  ];

  filas.forEach((f, i) => {
    const ri = 4 + i;
    ws.getCell(`B${ri}`).value = f[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    ws.getCell(`C${ri}`).value = f[1]; ws.getCell(`C${ri}`).style = styLabel();
  });
}

// =========================================================================
// HOJA 03 · DATOS INFORMATIVOS
// =========================================================================
function addDatosInformativos(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.DATOS_INF, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 8 }, { width: 65 }, { width: 12 }, { width: 3 }];

  ws.mergeCells("B2:D2");
  ws.getCell("B2").value = "DATOS INFORMATIVOS · FLAGS MUISCA";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.getCell("B4").value = "CAMPO"; ws.getCell("B4").style = styColHeader();
  ws.getCell("C4").value = "DESCRIPCIÓN"; ws.getCell("C4").style = styColHeader();
  ws.getCell("D4").value = "VALOR"; ws.getCell("D4").style = styColHeader();
  ws.getRow(4).height = 20;

  const h1 = d.h1;
  const flags: [number, string, boolean | null | undefined | string | number][] = [
    [30, "Persona Natural sin residencia", h1?.pn_sin_residencia],
    [31, "Contribuyente del Régimen Tributario Especial (RTE)", h1?.rte],
    [32, "Entidad Cooperativa (Art. 19-4 E.T.)", h1?.entidad_cooperativa],
    [33, "Entidad del sector financiero", h1?.entidad_sector_financiero],
    [34, "Nueva sociedad · ZOMAC", h1?.nueva_sociedad_zomac],
    [35, "Obras por impuestos · ZOMAC", h1?.obras_por_impuestos_zomac],
    [36, "Programa de reorganización empresarial", h1?.reorganizacion_empresarial],
    [37, "Soc. extranjera de transporte Colombia/exterior", h1?.soc_extranjera_transporte],
    [38, "Sistemas especiales de valoración de inversiones", h1?.sist_especial_valoracion],
    [39, "Costo inventarios · juego de inventarios", h1?.costo_inv_juego_inv],
    [40, "Costo inventarios · simultáneo", h1?.costo_inv_simultaneo],
    [41, "Progresividad tarifa de renta", h1?.progresividad_tarifa],
    [42, "Contrato de estabilidad jurídica", h1?.contrato_estabilidad],
    [43, "Moneda funcional diferente al peso", h1?.moneda_funcional_diferente],
    [44, "Mega-Inversiones", h1?.mega_inversiones],
    [45, "Economía Naranja", h1?.economia_naranja],
    [46, "Compañía Holding Colombiana (CHC)", h1?.holding_colombiana],
    [47, "Zona Económica y Social Especial (ZESE)", h1?.zese],
    [48, "Extracción de hulla / carbón (CIIU 0510/0520)", h1?.extraccion_hulla_carbon],
    [49, "Extracción de petróleo crudo (CIIU 0610)", h1?.extraccion_petroleo],
    [50, "Generación energía eléctrica · recursos hídricos", h1?.generacion_energia_hidro],
    [51, "Zona Franca", h1?.zona_franca],
  ];

  flags.forEach((f, i) => {
    const ri = 5 + i;
    ws.getCell(`B${ri}`).value = String(f[0]); ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = f[1]; ws.getCell(`C${ri}`).style = styLabel();
    const val = f[2] === true ? "✓ Sí" : f[2] === false ? "—" : f[2] ?? "—";
    ws.getCell(`D${ri}`).value = val;
    ws.getCell(`D${ri}`).style = {
      ...styLabel(),
      alignment: { vertical: "middle", horizontal: "center" },
      font: { bold: f[2] === true, color: { argb: f[2] === true ? "FF2E7D32" : "FF999999" }, size: 10 },
    };
  });

  // Marco normativo y tarifa
  const startMN = 5 + flags.length + 2;
  ws.mergeCells(`B${startMN}:D${startMN}`);
  ws.getCell(`B${startMN}`).value = "MARCO NORMATIVO Y TARIFA"; ws.getCell(`B${startMN}`).style = stySection();
  ws.getRow(startMN).height = 22;

  const extras: [string, string | number][] = [
    ["Marco normativo aplicable", h1?.marco_normativo ?? "NIIF Pymes"],
    ["Tarifa aplicable", h1?.tarifa_aplicable ?? "35%"],
    ["Artículo aplicable", h1?.art_aplicable ?? "240 E.T."],
    ["Obligado a tener revisor fiscal", h1?.obligado_revisor_fiscal ? "Sí" : "No"],
    ["Estados financieros con salvedades", h1?.con_salvedades ? "Sí" : "No"],
    ["Fecha efectiva de la transacción", h1?.fecha_efectiva_transaccion ?? "—"],
  ];
  extras.forEach((e, i) => {
    const ri = startMN + 1 + i;
    ws.mergeCells(`B${ri}:C${ri}`);
    ws.getCell(`B${ri}`).value = e[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    ws.getCell(`D${ri}`).value = e[1]; ws.getCell(`D${ri}`).style = styLabel();
  });
}

// =========================================================================
// HOJA 04 · BALANCE DE PRUEBA
// =========================================================================
function addBalancePrueba(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.BALANCE, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [
    { width: 3 }, { width: 14 }, { width: 45 },
    { width: 18 }, { width: 14 }, { width: 14 }, { width: 18 },
    { width: 10 }, { width: 10 }, { width: 7 }, { width: 3 },
  ];

  ws.mergeCells("B2:J2");
  ws.getCell("B2").value = "BALANCE DE PRUEBA · CUENTAS PUC CON SALDOS Y AJUSTES";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.mergeCells("B3:J3");
  ws.getCell("B3").value = `${d.empresa.razon_social} · NIT ${d.empresa.nit} · AG ${d.declaracion.ano_gravable} · ${d.balance.length} cuentas`;
  ws.getCell("B3").style = stySubBanner();

  const hdrs = ["CUENTA", "DESCRIPCIÓN", "SALDO CONTABLE", "AJUSTE DB", "AJUSTE CR", "SALDO FISCAL", "REN. H2", "REN. H3", "HOJA"];
  hdrs.forEach((h, i) => {
    const c = String.fromCharCode("B".charCodeAt(0) + i);
    ws.getCell(`${c}5`).value = h;
    ws.getCell(`${c}5`).style = styColHeader();
  });
  ws.getRow(5).height = 28;

  d.balance.forEach((l, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = l.cuenta;
    ws.getCell(`B${ri}`).style = { ...styLabel(), font: { color: { argb: TRIBAI_INK }, name: "Consolas", size: 10 } };
    ws.getCell(`C${ri}`).value = l.nombre;
    ws.getCell(`C${ri}`).style = styLabel();
    ws.getCell(`D${ri}`).value = l.saldo;
    ws.getCell(`D${ri}`).style = styMoneyInput();
    ws.getCell(`E${ri}`).value = l.ajuste_debito;
    ws.getCell(`E${ri}`).style = styMoneyInput();
    ws.getCell(`F${ri}`).value = l.ajuste_credito;
    ws.getCell(`F${ri}`).style = styMoneyInput();
    // Saldo fiscal = D + E - F
    ws.getCell(`G${ri}`).value = { formula: `D${ri}+E${ri}-F${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`G${ri}`).style = styMoneyTotal();
    ws.getCell(`H${ri}`).value = l.renglon_h2 ?? "";
    ws.getCell(`H${ri}`).style = { ...styRenglon(), alignment: { vertical: "middle", horizontal: "center" } };
    ws.getCell(`I${ri}`).value = l.renglon_h3 ?? "";
    ws.getCell(`I${ri}`).style = { ...styRenglon(), alignment: { vertical: "middle", horizontal: "center" } };
    ws.getCell(`J${ri}`).value = l.es_hoja ? "✓" : "";
    ws.getCell(`J${ri}`).style = { ...styLabel(), alignment: { vertical: "middle", horizontal: "center" } };
  });

  // Totales
  const tot = 6 + d.balance.length;
  ws.getCell(`C${tot}`).value = "TOTAL";
  ws.getCell(`C${tot}`).style = { ...stySection(), alignment: { vertical: "middle", horizontal: "right", indent: 1 } };
  ws.getCell(`D${tot}`).value = { formula: `SUM(D6:D${tot - 1})` } as ExcelJS.CellFormulaValue;
  ws.getCell(`D${tot}`).style = styMoneyTotal();
  ws.getCell(`E${tot}`).value = { formula: `SUM(E6:E${tot - 1})` } as ExcelJS.CellFormulaValue;
  ws.getCell(`E${tot}`).style = styMoneyTotal();
  ws.getCell(`F${tot}`).value = { formula: `SUM(F6:F${tot - 1})` } as ExcelJS.CellFormulaValue;
  ws.getCell(`F${tot}`).style = styMoneyTotal();
  ws.getCell(`G${tot}`).value = { formula: `SUM(G6:G${tot - 1})` } as ExcelJS.CellFormulaValue;
  ws.getCell(`G${tot}`).style = styMoneyTotal();

  ws.autoFilter = { from: { row: 5, column: 2 }, to: { row: 5 + d.balance.length, column: 10 } };
}

// =========================================================================
// HOJA 05 · HOJA SUMARIA · PIVOTE CENTRAL
// =========================================================================
function addHojaSumaria(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.SUMARIA, {
    properties: { tabColor: { argb: TRIBAI_GOLD } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [
    { width: 3 }, { width: 14 }, { width: 42 },
    { width: 18 }, { width: 14 }, { width: 14 }, { width: 18 },
    { width: 10 }, { width: 10 }, { width: 3 },
  ];

  ws.mergeCells("B2:I2");
  ws.getCell("B2").value = "HOJA SUMARIA · PIVOTE CENTRAL (formulada desde Balance)";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.mergeCells("B3:I3");
  ws.getCell("B3").value = "Esta hoja replica el Balance de Prueba pero TODAS las celdas son fórmulas. Modificar el Balance → se actualiza Sumaria → se actualizan H2/H3/Sigmas/Liquidación.";
  ws.getCell("B3").style = stySubBanner();

  const hdrs = ["CUENTA", "DESCRIPCIÓN", "SALDO CONTABLE", "AJUSTE DB", "AJUSTE CR", "SALDO FISCAL", "REN. H2", "REN. H3"];
  hdrs.forEach((h, i) => {
    const c = String.fromCharCode("B".charCodeAt(0) + i);
    ws.getCell(`${c}5`).value = h; ws.getCell(`${c}5`).style = styColHeader();
  });
  ws.getRow(5).height = 28;

  // Cada celda referencia la fila correspondiente del Balance · 1:1
  // Fila n en Balance = 6 + (n-6) (porque ambos empiezan en fila 6)
  d.balance.forEach((l, i) => {
    const ri = 6 + i;
    const balRow = ri; // Balance está en la misma fila
    const cell = (col: string, formula: string) => {
      ws.getCell(`${col}${ri}`).value = { formula } as ExcelJS.CellFormulaValue;
    };
    cell("B", `'${SHEET.BALANCE}'!B${balRow}`);
    ws.getCell(`B${ri}`).style = { ...styLabel(), font: { color: { argb: TRIBAI_INK }, name: "Consolas", size: 10 } };
    cell("C", `'${SHEET.BALANCE}'!C${balRow}`);
    ws.getCell(`C${ri}`).style = styLabel();
    cell("D", `'${SHEET.BALANCE}'!D${balRow}`);
    ws.getCell(`D${ri}`).style = styMoney();
    cell("E", `'${SHEET.BALANCE}'!E${balRow}`);
    ws.getCell(`E${ri}`).style = styMoney();
    cell("F", `'${SHEET.BALANCE}'!F${balRow}`);
    ws.getCell(`F${ri}`).style = styMoney();
    cell("G", `D${ri}+E${ri}-F${ri}`);
    ws.getCell(`G${ri}`).style = styMoneyTotal();
    // Renglón sólo si es cuenta-hoja (evita duplicación)
    if (l.es_hoja && l.renglon_h2 != null) {
      ws.getCell(`H${ri}`).value = l.renglon_h2;
    }
    ws.getCell(`H${ri}`).style = { ...styRenglon(), alignment: { vertical: "middle", horizontal: "center" } };
    if (l.es_hoja && l.renglon_h3 != null) {
      ws.getCell(`I${ri}`).value = l.renglon_h3;
    }
    ws.getCell(`I${ri}`).style = { ...styRenglon(), alignment: { vertical: "middle", horizontal: "center" } };
  });

  // Totales
  const tot = 6 + d.balance.length;
  ws.getCell(`C${tot}`).value = "TOTAL"; ws.getCell(`C${tot}`).style = { ...stySection(), alignment: { vertical: "middle", horizontal: "right", indent: 1 } };
  ["D", "E", "F", "G"].forEach((c) => {
    ws.getCell(`${c}${tot}`).value = { formula: `SUM(${c}6:${c}${tot - 1})` } as ExcelJS.CellFormulaValue;
    ws.getCell(`${c}${tot}`).style = styMoneyTotal();
  });

  ws.autoFilter = { from: { row: 5, column: 2 }, to: { row: tot, column: 9 } };
}

// =========================================================================
// HOJA 06 · F-2516 H1 CARÁTULA
// =========================================================================
function addH1Caratula(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.H1, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 8 }, { width: 50 }, { width: 35 }, { width: 3 }];

  ws.mergeCells("B2:D2");
  ws.getCell("B2").value = "F-2516 H1 · CARÁTULA (Reporte Conciliación Fiscal)";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.mergeCells("B3:D3");
  ws.getCell("B3").value = "Anexo Formulario 110 · Resolución DIAN 71/2019 · referencias a hoja 02 Datos Básicos y 03 Datos Informativos";
  ws.getCell("B3").style = stySubBanner();

  // Sección 1: identificación (referenciada de Datos Básicos)
  ws.mergeCells("B5:D5"); ws.getCell("B5").value = "Sección 1 · IDENTIFICACIÓN"; ws.getCell("B5").style = stySection();
  ws.getRow(5).height = 22;

  const idRows: [number, string, string][] = [
    [25, "Razón social", `'${SHEET.DATOS_BASICOS}'!C4`],
    [5, "NIT", `'${SHEET.DATOS_BASICOS}'!C5`],
    [6, "DV", `'${SHEET.DATOS_BASICOS}'!C6`],
    [24, "Año gravable", `'${SHEET.DATOS_BASICOS}'!C15`],
    [27, "Régimen tributario", `'${SHEET.DATOS_BASICOS}'!C8`],
    [28, "Código CIIU", `'${SHEET.DATOS_BASICOS}'!C9`],
  ];
  idRows.forEach((r, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = String(r[0]); ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = r[1]; ws.getCell(`C${ri}`).style = styLabelBold();
    ws.getCell(`D${ri}`).value = { formula: r[2] } as ExcelJS.CellFormulaValue;
    ws.getCell(`D${ri}`).style = styLabel();
  });

  // Sección 2: marco normativo y tarifa
  const sM = 6 + idRows.length + 1;
  ws.mergeCells(`B${sM}:D${sM}`); ws.getCell(`B${sM}`).value = "Sección 2 · MARCO NORMATIVO Y TARIFA"; ws.getCell(`B${sM}`).style = stySection();
  ws.getRow(sM).height = 22;
  const mrows: [number, string, string][] = [
    [29, "Marco normativo aplicable", d.h1?.marco_normativo ?? "NIIF Pymes"],
    [52, "Tarifa aplicable", String(d.h1?.tarifa_aplicable ?? "35%")],
    [53, "Artículo aplicable", String(d.h1?.art_aplicable ?? "240 E.T.")],
  ];
  mrows.forEach((r, i) => {
    const ri = sM + 1 + i;
    ws.getCell(`B${ri}`).value = String(r[0]); ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = r[1]; ws.getCell(`C${ri}`).style = styLabelBold();
    ws.getCell(`D${ri}`).value = r[2]; ws.getCell(`D${ri}`).style = styLabel();
  });

  // Sección 3: representante legal y revisor fiscal
  const sR = sM + 1 + mrows.length + 1;
  ws.mergeCells(`B${sR}:D${sR}`); ws.getCell(`B${sR}`).value = "Sección 3 · SIGNATARIOS"; ws.getCell(`B${sR}`).style = stySection();
  ws.getRow(sR).height = 22;
  const srows: [number, string, string | number][] = [
    [994, "Representante legal", d.h1?.rep_legal_nombre ?? "—"],
    [995, "Documento R.L.", `${d.h1?.rep_legal_tipo_doc ?? "CC"} ${d.h1?.rep_legal_numero_doc ?? ""}`],
    [996, "Contador público", d.h1?.contador_nombre ?? "—"],
    [997, "T.P. Contador", d.h1?.contador_tarjeta_prof ?? "—"],
    [983, "Revisor fiscal", d.h1?.rf_nombre ?? "—"],
    [984, "T.P. Revisor fiscal", d.h1?.rf_tarjeta_prof ?? "—"],
  ];
  srows.forEach((r, i) => {
    const ri = sR + 1 + i;
    ws.getCell(`B${ri}`).value = String(r[0]); ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = r[1]; ws.getCell(`C${ri}`).style = styLabelBold();
    ws.getCell(`D${ri}`).value = r[2]; ws.getCell(`D${ri}`).style = styLabel();
  });
}

// =========================================================================
// HOJA 07 · F-2516 H2 ESF PATRIMONIO · con SUMIFS a Hoja Sumaria
// =========================================================================
function addH2ESF(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.H2, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [
    { width: 3 }, { width: 8 }, { width: 60 },
    { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 },
    { width: 3 },
  ];

  ws.mergeCells("B2:H2");
  ws.getCell("B2").value = "F-2516 H2 · ESTADO DE SITUACIÓN FINANCIERA · PATRIMONIO";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.mergeCells("B3:H3");
  ws.getCell("B3").value = `${d.h2Catalogo.length} renglones oficiales DIAN · contable formulado con SUMIFS sobre Hoja Sumaria · saldo fiscal = contable + Conv − Menor + Mayor`;
  ws.getCell("B3").style = stySubBanner();

  const hdrs = ["NUM", "Concepto", "Val1 · Contable", "Val2 · Conv", "Val3 · Menor", "Val4 · Mayor", "Val5 · FISCAL"];
  hdrs.forEach((h, i) => {
    const c = String.fromCharCode("B".charCodeAt(0) + i);
    ws.getCell(`${c}5`).value = h; ws.getCell(`${c}5`).style = styColHeader();
  });
  ws.getRow(5).height = 28;

  const sumaRowEnd = 6 + d.balance.length - 1; // última fila de datos en Sumaria
  d.h2Catalogo.forEach((r, i) => {
    const ri = 6 + i;
    const isNivel1 = r.nivel === 1;
    const isNivel2 = r.nivel === 2 && r.esTotal;
    ws.getCell(`B${ri}`).value = String(r.id);
    ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = `${"  ".repeat(r.nivel - 1)}${r.concepto}`;
    ws.getCell(`C${ri}`).style = isNivel1 ? styNivel1() : isNivel2 ? styNivel2() : styLabel();
    if (r.esSumif) {
      // SUMIFS sobre Hoja Sumaria col G (saldo fiscal absoluto) WHERE col H = r.id
      ws.getCell(`D${ri}`).value = {
        formula: `SUMIFS('${SHEET.SUMARIA}'!G6:G${sumaRowEnd},'${SHEET.SUMARIA}'!H6:H${sumaRowEnd},${r.id})`,
      } as ExcelJS.CellFormulaValue;
      ws.getCell(`D${ri}`).style = styMoney();
      ws.getCell(`E${ri}`).value = 0; ws.getCell(`E${ri}`).style = styMoneyInput();
      ws.getCell(`F${ri}`).value = 0; ws.getCell(`F${ri}`).style = styMoneyInput();
      ws.getCell(`G${ri}`).value = 0; ws.getCell(`G${ri}`).style = styMoneyInput();
      ws.getCell(`H${ri}`).value = { formula: `ABS(D${ri})+E${ri}-F${ri}+G${ri}` } as ExcelJS.CellFormulaValue;
      ws.getCell(`H${ri}`).style = styMoneyTotal();
    } else if (r.esTotal) {
      // Total = suma de hijos (renglones siguientes hasta el próximo padre con nivel <= )
      // Simplificación: dejar fórmula vacía o referenciar suma del bloque
      const hijos = obtenerHijos(d.h2Catalogo, i);
      if (hijos.length) {
        const refs = hijos.map((idx) => `H${6 + idx}`).join("+");
        ws.getCell(`H${ri}`).value = { formula: refs } as ExcelJS.CellFormulaValue;
        ws.getCell(`H${ri}`).style = styMoneyTotal();
        // También contable como suma
        const refsC = hijos.map((idx) => `D${6 + idx}`).join("+");
        ws.getCell(`D${ri}`).value = { formula: refsC } as ExcelJS.CellFormulaValue;
        ws.getCell(`D${ri}`).style = { ...styMoney(), font: { bold: true, color: { argb: TRIBAI_INK }, size: 10 } };
      }
    } else {
      // categoría sin sumar
      ws.getCell(`D${ri}`).style = styLabel();
    }
  });
}

// Helper: índices de hijos directos de un renglón total
function obtenerHijos<T extends { nivel: number; esSumif: boolean; esTotal: boolean }>(
  catalogo: T[],
  idxPadre: number,
): number[] {
  const padre = catalogo[idxPadre];
  const hijos: number[] = [];
  for (let i = idxPadre + 1; i < catalogo.length; i++) {
    const h = catalogo[i];
    if (h.nivel <= padre.nivel) break;
    if (h.nivel === padre.nivel + 1 && (h.esSumif || h.esTotal)) {
      hijos.push(i);
    }
  }
  return hijos;
}

// =========================================================================
// HOJA 08 · F-2516 H3 ERI · con SUMIFS
// =========================================================================
function addH3ERI(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.H3, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [
    { width: 3 }, { width: 8 }, { width: 55 },
    { width: 16 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 16 },
    { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 },
    { width: 3 },
  ];

  ws.mergeCells("B2:L2");
  ws.getCell("B2").value = "F-2516 H3 · ESTADO DE RESULTADOS · RENTA LÍQUIDA";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.mergeCells("B3:L3");
  ws.getCell("B3").value = `${d.h3Catalogo.length} renglones · contable formulado SUMIFS sobre Hoja Sumaria col I · Val5 = D+E−F+G · RL por tarifa (Gen, ZF, Div, GO) editables`;
  ws.getCell("B3").style = stySubBanner();

  const hdrs = ["NUM", "Concepto", "Val1 · Contable", "Val2 · Conv", "Val3 · Menor", "Val4 · Mayor", "Val5 · FISCAL", "RL Gen", "RL ZF", "RL Div", "RL GO"];
  hdrs.forEach((h, i) => {
    const c = String.fromCharCode("B".charCodeAt(0) + i);
    ws.getCell(`${c}5`).value = h; ws.getCell(`${c}5`).style = styColHeader();
  });
  ws.getRow(5).height = 28;

  const sumaEnd = 6 + d.balance.length - 1;
  d.h3Catalogo.forEach((r, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = String(r.id); ws.getCell(`B${ri}`).style = styRenglon();
    const isN1 = r.nivel === 1;
    const isN2T = r.nivel === 2 && r.esTotal;
    ws.getCell(`C${ri}`).value = `${"  ".repeat(r.nivel - 1)}${r.concepto}`;
    ws.getCell(`C${ri}`).style = isN1 ? styNivel1() : isN2T ? styNivel2() : styLabel();
    if (r.esSumif) {
      ws.getCell(`D${ri}`).value = {
        formula: `SUMIFS('${SHEET.SUMARIA}'!G6:G${sumaEnd},'${SHEET.SUMARIA}'!I6:I${sumaEnd},${r.id})`,
      } as ExcelJS.CellFormulaValue;
      ws.getCell(`D${ri}`).style = styMoney();
      ws.getCell(`E${ri}`).value = 0; ws.getCell(`E${ri}`).style = styMoneyInput();
      ws.getCell(`F${ri}`).value = 0; ws.getCell(`F${ri}`).style = styMoneyInput();
      ws.getCell(`G${ri}`).value = 0; ws.getCell(`G${ri}`).style = styMoneyInput();
      ws.getCell(`H${ri}`).value = { formula: `ABS(D${ri})+E${ri}-F${ri}+G${ri}` } as ExcelJS.CellFormulaValue;
      ws.getCell(`H${ri}`).style = styMoneyTotal();
      // RL inputs (Val6-12 simplificado a 4 columnas)
      ["I", "J", "K", "L"].forEach((col) => {
        ws.getCell(`${col}${ri}`).value = 0;
        ws.getCell(`${col}${ri}`).style = styMoneyInput();
      });
    } else if (r.esTotal) {
      const hijos = obtenerHijos(d.h3Catalogo, i);
      if (hijos.length) {
        const refsD = hijos.map((idx) => `D${6 + idx}`).join("+");
        const refsH = hijos.map((idx) => `H${6 + idx}`).join("+");
        ws.getCell(`D${ri}`).value = { formula: refsD } as ExcelJS.CellFormulaValue;
        ws.getCell(`D${ri}`).style = { ...styMoney(), font: { bold: true, color: { argb: TRIBAI_INK }, size: 10 } };
        ws.getCell(`H${ri}`).value = { formula: refsH } as ExcelJS.CellFormulaValue;
        ws.getCell(`H${ri}`).style = styMoneyTotal();
      }
    } else {
      ws.getCell(`D${ri}`).style = styLabel();
    }
  });
}

// =========================================================================
// HOJA 09 · F-2516 H4 IMPUESTO DIFERIDO
// =========================================================================
function addH4ImpDif(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.H4, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 50 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 3 }];

  ws.mergeCells("B2:E2");
  ws.getCell("B2").value = "F-2516 H4 · IMPUESTO DIFERIDO";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.mergeCells("B3:E3");
  ws.getCell("B3").value = "Categorías oficiales DIAN · 18 ATD + 18 PTD simétricas · diferencias temporarias";
  ws.getCell("B3").style = stySubBanner();

  ws.getCell("B5").value = "CATEGORÍA"; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "ATD · ACTIVOS"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "PTD · PASIVOS"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "NETO (ATD-PTD)"; ws.getCell("E5").style = styColHeader();
  ws.getRow(5).height = 28;

  const filasH4 = d.h4?.filas ?? [];
  if (filasH4.length === 0) {
    // Catálogo base si no hay datos
    const base = [
      "Efectivo y equivalentes", "Inversiones", "Cuentas por cobrar", "Inventarios",
      "Propiedad planta y equipo", "Intangibles", "Propiedades de inversión",
      "Activos biológicos", "ANCMV", "Pasivos financieros", "Impuestos por pagar",
      "Beneficios empleados", "Provisiones", "Otros pasivos", "Operaciones títulos",
      "Pérdidas fiscales", "Activos solo fiscales", "Otros",
    ];
    base.forEach((nombre, i) => {
      const ri = 6 + i;
      ws.getCell(`B${ri}`).value = nombre; ws.getCell(`B${ri}`).style = styLabel();
      ws.getCell(`C${ri}`).value = 0; ws.getCell(`C${ri}`).style = styMoneyInput();
      ws.getCell(`D${ri}`).value = 0; ws.getCell(`D${ri}`).style = styMoneyInput();
      ws.getCell(`E${ri}`).value = { formula: `C${ri}-D${ri}` } as ExcelJS.CellFormulaValue;
      ws.getCell(`E${ri}`).style = styMoneyTotal();
    });
    const tot = 6 + base.length;
    ws.getCell(`B${tot}`).value = "TOTAL"; ws.getCell(`B${tot}`).style = stySection();
    ws.getCell(`C${tot}`).value = { formula: `SUM(C6:C${tot - 1})` } as ExcelJS.CellFormulaValue; ws.getCell(`C${tot}`).style = styMoneyTotal();
    ws.getCell(`D${tot}`).value = { formula: `SUM(D6:D${tot - 1})` } as ExcelJS.CellFormulaValue; ws.getCell(`D${tot}`).style = styMoneyTotal();
    ws.getCell(`E${tot}`).value = { formula: `C${tot}-D${tot}` } as ExcelJS.CellFormulaValue; ws.getCell(`E${tot}`).style = styMoneyTotal();
  } else {
    filasH4.forEach((f, i) => {
      const ri = 6 + i;
      ws.getCell(`B${ri}`).value = f.categoria.concepto;
      ws.getCell(`B${ri}`).style = styLabel();
      ws.getCell(`C${ri}`).value = f.categoria.tipo === "atd" ? f.impuestoDiferido : 0;
      ws.getCell(`C${ri}`).style = styMoney();
      ws.getCell(`D${ri}`).value = f.categoria.tipo === "ptd" ? f.impuestoDiferido : 0;
      ws.getCell(`D${ri}`).style = styMoney();
      ws.getCell(`E${ri}`).value = { formula: `C${ri}-D${ri}` } as ExcelJS.CellFormulaValue;
      ws.getCell(`E${ri}`).style = styMoneyTotal();
    });
    const tot = 6 + filasH4.length;
    ws.getCell(`B${tot}`).value = "TOTAL"; ws.getCell(`B${tot}`).style = stySection();
    ws.getCell(`C${tot}`).value = d.h4?.totalATD ?? 0; ws.getCell(`C${tot}`).style = styMoneyTotal();
    ws.getCell(`D${tot}`).value = d.h4?.totalPTD ?? 0; ws.getCell(`D${tot}`).style = styMoneyTotal();
    ws.getCell(`E${tot}`).value = d.h4?.impuestoDiferidoNeto ?? 0; ws.getCell(`E${tot}`).style = styMoneyTotal();
  }
}

// =========================================================================
// HOJA 10 · F-2516 H5 INGRESOS Y FACTURACIÓN
// =========================================================================
function addH5Ingresos(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.H5, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 50 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 3 }];

  ws.mergeCells("B2:E2");
  ws.getCell("B2").value = "F-2516 H5 · INGRESOS Y FACTURACIÓN";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  const conceptos = [
    "Venta de bienes",
    "Prestación de servicios",
    "Otros ingresos",
    "Ingresos por cuenta de terceros",
    "Ajustes a lo facturado",
  ];
  ws.getCell("B5").value = "CONCEPTO"; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "FACTURADO"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "FISCAL H3"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "DIFERENCIA"; ws.getCell("E5").style = styColHeader();
  ws.getRow(5).height = 28;

  conceptos.forEach((c, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = c; ws.getCell(`B${ri}`).style = styLabel();
    ws.getCell(`C${ri}`).value = 0; ws.getCell(`C${ri}`).style = styMoneyInput();
    ws.getCell(`D${ri}`).value = 0; ws.getCell(`D${ri}`).style = styMoneyInput();
    ws.getCell(`E${ri}`).value = { formula: `C${ri}-D${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = styMoneyTotal();
  });
}

// =========================================================================
// HOJA 11 · F-2516 H6 ACTIVOS FIJOS
// =========================================================================
function addH6ActivosFijos(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.H6, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [
    { width: 3 }, { width: 32 }, { width: 16 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 3 },
  ];

  ws.mergeCells("B2:H2");
  ws.getCell("B2").value = "F-2516 H6 · ACTIVOS FIJOS · DEPRECIACIÓN FISCAL";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.getCell("B5").value = "CATEGORÍA"; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "COSTO INICIAL"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "ADICIONES"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "RETIROS"; ws.getCell("E5").style = styColHeader();
  ws.getCell("F5").value = "COSTO FINAL"; ws.getCell("F5").style = styColHeader();
  ws.getCell("G5").value = "DEPRECIACIÓN AC."; ws.getCell("G5").style = styColHeader();
  ws.getCell("H5").value = "VALOR NETO"; ws.getCell("H5").style = styColHeader();
  ws.getRow(5).height = 28;

  const cats = [
    "Terrenos", "Construcciones y edificaciones",
    "Maquinaria y equipo", "Equipo de oficina",
    "Equipo de cómputo y comunicaciones", "Flota y equipo de transporte",
    "Equipo médico-científico", "Otros activos fijos",
  ];
  cats.forEach((c, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = c; ws.getCell(`B${ri}`).style = styLabel();
    ["C", "D", "E"].forEach((col) => {
      ws.getCell(`${col}${ri}`).value = 0; ws.getCell(`${col}${ri}`).style = styMoneyInput();
    });
    ws.getCell(`F${ri}`).value = { formula: `C${ri}+D${ri}-E${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`F${ri}`).style = styMoneyTotal();
    ws.getCell(`G${ri}`).value = 0; ws.getCell(`G${ri}`).style = styMoneyInput();
    ws.getCell(`H${ri}`).value = { formula: `F${ri}-G${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`H${ri}`).style = styMoneyTotal();
  });
  const tot = 6 + cats.length;
  ws.getCell(`B${tot}`).value = "TOTAL"; ws.getCell(`B${tot}`).style = stySection();
  ["C", "D", "E", "F", "G", "H"].forEach((c) => {
    ws.getCell(`${c}${tot}`).value = { formula: `SUM(${c}6:${c}${tot - 1})` } as ExcelJS.CellFormulaValue;
    ws.getCell(`${c}${tot}`).style = styMoneyTotal();
  });
}

// =========================================================================
// HOJA 12 · F-2516 H7 RESUMEN ESF-ERI
// =========================================================================
function addH7Resumen(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.H7, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 50 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 3 }];

  ws.mergeCells("B2:E2");
  ws.getCell("B2").value = "F-2516 H7 · RESUMEN ESF / ERI · CONEXIONES";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.mergeCells("B3:E3");
  ws.getCell("B3").value = "Totales clave referenciados desde H2 (patrimonial) y H3 (resultados)";
  ws.getCell("B3").style = stySubBanner();

  ws.getCell("B5").value = "CONCEPTO"; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "VALOR CONTABLE"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "VALOR FISCAL"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "DIFERENCIA"; ws.getCell("E5").style = styColHeader();
  ws.getRow(5).height = 28;

  const filas: [string, string][] = [
    ["Activos", `'${SHEET.H2}'!H6`], // renglón ACTIVOS (id 10) en H2
    ["Pasivos", `'${SHEET.H2}'!H100`],
    ["Patrimonio", `'${SHEET.H2}'!H180`],
    ["Total ingresos", `'${SHEET.H3}'!H6`],
    ["Total costos y deducciones", `'${SHEET.H3}'!H200`],
    ["Renta líquida", `'${SHEET.H3}'!H400`],
  ];
  filas.forEach((f, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = f[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    // Las celdas son sólo referenciales; los datos contables exactos provienen de H2/H3 según renglón
    ws.getCell(`C${ri}`).value = 0; ws.getCell(`C${ri}`).style = styMoneyInput();
    ws.getCell(`D${ri}`).value = 0; ws.getCell(`D${ri}`).style = styMoneyInput();
    ws.getCell(`E${ri}`).value = { formula: `D${ri}-C${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = styMoneyTotal();
  });
}

// =========================================================================
// HOJA 13 · Σ PATRIMONIO
// =========================================================================
function addSigmaPatrimonio(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.S_PATR, {
    properties: { tabColor: { argb: TRIBAI_GOLD } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [{ width: 3 }, { width: 8 }, { width: 60 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 3 }];

  ws.mergeCells("B2:F2");
  ws.getCell("B2").value = "Σ PATRIMONIO · DETALLE";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:F3");
  ws.getCell("B3").value = "Detalle de Activos / Pasivos / Patrimonio fiscal por renglón H2";
  ws.getCell("B3").style = stySubBanner();

  ws.getCell("B5").value = "REN. H2"; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "Concepto"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "Contable"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "Fiscal"; ws.getCell("E5").style = styColHeader();
  ws.getCell("F5").value = "Diferencia"; ws.getCell("F5").style = styColHeader();
  ws.getRow(5).height = 24;

  // Mostrar solo renglones donde el contable sea > 0 (operativos)
  const conValor = d.h2Catalogo.filter((r) => r.esSumif);
  conValor.forEach((r, i) => {
    const ri = 6 + i;
    const idxOriginal = d.h2Catalogo.findIndex((x) => x.id === r.id);
    const h2Row = 6 + idxOriginal;
    ws.getCell(`B${ri}`).value = String(r.id); ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = r.concepto; ws.getCell(`C${ri}`).style = styLabel();
    ws.getCell(`D${ri}`).value = { formula: `'${SHEET.H2}'!D${h2Row}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`D${ri}`).style = styMoney();
    ws.getCell(`E${ri}`).value = { formula: `'${SHEET.H2}'!H${h2Row}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = styMoney();
    ws.getCell(`F${ri}`).value = { formula: `E${ri}-D${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`F${ri}`).style = styMoneyTotal();
  });

  const tot = 6 + conValor.length;
  ws.getCell(`C${tot}`).value = "TOTAL PATRIMONIAL"; ws.getCell(`C${tot}`).style = stySection();
  ["D", "E", "F"].forEach((c) => {
    ws.getCell(`${c}${tot}`).value = { formula: `SUM(${c}6:${c}${tot - 1})` } as ExcelJS.CellFormulaValue;
    ws.getCell(`${c}${tot}`).style = styMoneyTotal();
  });
}

// =========================================================================
// HOJA 14 · Σ INGRESOS
// =========================================================================
function addSigmaIngresos(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.S_ING, {
    properties: { tabColor: { argb: TRIBAI_GOLD } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [{ width: 3 }, { width: 8 }, { width: 60 }, { width: 18 }, { width: 18 }, { width: 3 }];

  ws.mergeCells("B2:E2");
  ws.getCell("B2").value = "Σ INGRESOS · DETALLE DESDE H3";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.getCell("B5").value = "REN. H3"; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "Concepto"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "Contable"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "Fiscal"; ws.getCell("E5").style = styColHeader();
  ws.getRow(5).height = 24;

  // Renglones de ingresos: nivel 2-3 que esSumif, antes de "Costos"
  const ingresos = d.h3Catalogo
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.esSumif && /ingres|venta|servicio|honorar/i.test(r.concepto))
    .slice(0, 60);
  ingresos.forEach((r, i) => {
    const ri = 6 + i;
    const h3Row = 6 + r.idx;
    ws.getCell(`B${ri}`).value = String(r.id); ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = r.concepto; ws.getCell(`C${ri}`).style = styLabel();
    ws.getCell(`D${ri}`).value = { formula: `'${SHEET.H3}'!D${h3Row}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`D${ri}`).style = styMoney();
    ws.getCell(`E${ri}`).value = { formula: `'${SHEET.H3}'!H${h3Row}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = styMoney();
  });
  const tot = 6 + ingresos.length;
  ws.getCell(`C${tot}`).value = "TOTAL INGRESOS"; ws.getCell(`C${tot}`).style = stySection();
  ws.getCell(`D${tot}`).value = { formula: `SUM(D6:D${tot - 1})` } as ExcelJS.CellFormulaValue;
  ws.getCell(`D${tot}`).style = styMoneyTotal();
  ws.getCell(`E${tot}`).value = { formula: `SUM(E6:E${tot - 1})` } as ExcelJS.CellFormulaValue;
  ws.getCell(`E${tot}`).style = styMoneyTotal();
}

// =========================================================================
// HOJA 15 · Σ COSTOS Y DEDUCCIONES
// =========================================================================
function addSigmaCostos(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.S_COSTOS, {
    properties: { tabColor: { argb: TRIBAI_GOLD } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [{ width: 3 }, { width: 8 }, { width: 60 }, { width: 18 }, { width: 18 }, { width: 3 }];

  ws.mergeCells("B2:E2");
  ws.getCell("B2").value = "Σ COSTOS Y DEDUCCIONES";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.getCell("B5").value = "REN. H3"; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "Concepto"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "Contable"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "Fiscal"; ws.getCell("E5").style = styColHeader();
  ws.getRow(5).height = 24;

  const costos = d.h3Catalogo
    .map((r, i) => ({ ...r, idx: i }))
    .filter((r) => r.esSumif && /costo|gasto|deduccion|deduc|deprec|amortiz|impuesto|sueldo|salario|provis|nomi/i.test(r.concepto))
    .slice(0, 100);
  costos.forEach((r, i) => {
    const ri = 6 + i;
    const h3Row = 6 + r.idx;
    ws.getCell(`B${ri}`).value = String(r.id); ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = r.concepto; ws.getCell(`C${ri}`).style = styLabel();
    ws.getCell(`D${ri}`).value = { formula: `'${SHEET.H3}'!D${h3Row}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`D${ri}`).style = styMoney();
    ws.getCell(`E${ri}`).value = { formula: `'${SHEET.H3}'!H${h3Row}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = styMoney();
  });
  const tot = 6 + costos.length;
  ws.getCell(`C${tot}`).value = "TOTAL COSTOS Y DEDUCCIONES"; ws.getCell(`C${tot}`).style = stySection();
  ws.getCell(`D${tot}`).value = { formula: `SUM(D6:D${tot - 1})` } as ExcelJS.CellFormulaValue;
  ws.getCell(`D${tot}`).style = styMoneyTotal();
  ws.getCell(`E${tot}`).value = { formula: `SUM(E6:E${tot - 1})` } as ExcelJS.CellFormulaValue;
  ws.getCell(`E${tot}`).style = styMoneyTotal();
}

// =========================================================================
// HOJA 16 · Σ RENTA
// =========================================================================
function addSigmaRenta(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.S_RENTA, {
    properties: { tabColor: { argb: TRIBAI_GOLD } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 55 }, { width: 20 }, { width: 3 }];

  ws.mergeCells("B2:C2");
  ws.getCell("B2").value = "Σ RENTA · CÁLCULO FINAL";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  // Buscar fila final de Σ Ingresos y Σ Costos para referenciar
  const sIngLen = d.h3Catalogo.filter((r) => r.esSumif && /ingres|venta|servicio|honorar/i.test(r.concepto)).slice(0, 60).length;
  const sCostosLen = d.h3Catalogo.filter((r) => r.esSumif && /costo|gasto|deduccion|deduc|deprec|amortiz|impuesto|sueldo|salario|provis|nomi/i.test(r.concepto)).slice(0, 100).length;

  const filas: [string, string | number][] = [
    ["(+) Total ingresos fiscales", `'${SHEET.S_ING}'!E${6 + sIngLen}`],
    ["(−) Total costos y deducciones", `'${SHEET.S_COSTOS}'!E${6 + sCostosLen}`],
    ["(=) RENTA LÍQUIDA ORDINARIA", ""],
    ["(−) Compensación pérdidas fiscales", `'${SHEET.AX_PERDIDAS}'!C10`],
    ["(=) RENTA LÍQUIDA DEL EJERCICIO", ""],
    ["(+) Renta presuntiva (mayor)", `'${SHEET.AX_RP}'!C30`],
    ["(=) RENTA LÍQUIDA GRAVABLE", ""],
  ];
  filas.forEach((r, i) => {
    const ri = 4 + i;
    ws.getCell(`B${ri}`).value = r[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    if (typeof r[1] === "string" && r[1].startsWith("'")) {
      ws.getCell(`C${ri}`).value = { formula: r[1] } as ExcelJS.CellFormulaValue;
    } else if (i === 2) {
      ws.getCell(`C${ri}`).value = { formula: `C${ri - 2}-C${ri - 1}` } as ExcelJS.CellFormulaValue;
    } else if (i === 4) {
      ws.getCell(`C${ri}`).value = { formula: `C${ri - 2}-C${ri - 1}` } as ExcelJS.CellFormulaValue;
    } else if (i === 6) {
      ws.getCell(`C${ri}`).value = { formula: `MAX(C${ri - 2},C${ri - 1})` } as ExcelJS.CellFormulaValue;
    } else {
      ws.getCell(`C${ri}`).value = r[1];
    }
    ws.getCell(`C${ri}`).style = i === 2 || i === 4 || i === 6 ? styMoneyTotal() : styMoney();
  });
}

// =========================================================================
// HOJA 17 · ANEXO CONCILIACIÓN PATRIMONIAL
// =========================================================================
function addAnxConciPatr(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.AX_CONCI_PATR, {
    properties: { tabColor: { argb: DIAN_BLUE_LIGHT } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 55 }, { width: 20 }, { width: 3 }];

  ws.mergeCells("B2:C2");
  ws.getCell("B2").value = "ANEXO 16 · CONCILIACIÓN PATRIMONIAL";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:C3");
  ws.getCell("B3").value = "Patrimonio contable vs Patrimonio fiscal · diferencias permanentes y temporales";
  ws.getCell("B3").style = stySubBanner();

  const cp = d.concPatrimonial;
  const filas: [string, number | string][] = [
    ["Patrimonio líquido año ANTERIOR", Number(cp?.plAnterior ?? 0)],
    ["Patrimonio líquido año ACTUAL (R46 F-110)", Number(cp?.plActual ?? 0)],
    ["(=) Variación bruta del patrimonio", ""],
    ["(+) Total justificantes (rentas, ingresos no constitutivos, etc.)", Number(cp?.totalJustificantes ?? 0)],
    ["(−) Total restadores (pérdidas, gastos no deducibles, etc.)", Number(cp?.totalRestadores ?? 0)],
    ["(=) Patrimonio líquido JUSTIFICADO", Number(cp?.plJustificado ?? 0)],
    ["(=) Diferencia por justificar (renta por comp. patrimonial)", Number(cp?.diferenciaPorJustificar ?? 0)],
    ["RENTA POR COMPARACIÓN PATRIMONIAL (R63 F-110)", Number(cp?.rentaPorComparacion ?? 0)],
  ];
  filas.forEach((r, i) => {
    const ri = 5 + i;
    ws.getCell(`B${ri}`).value = r[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    if (i === 2) {
      ws.getCell(`C${ri}`).value = { formula: `C${ri - 1}-C${ri - 2}` } as ExcelJS.CellFormulaValue;
    } else {
      ws.getCell(`C${ri}`).value = r[1] as number;
    }
    const esTotal = i === 2 || i === 5 || i === 6 || i === 7;
    ws.getCell(`C${ri}`).style = esTotal ? styMoneyTotal() : styMoney();
  });

  // Estado de cuadre
  const estadoRow = 5 + filas.length + 1;
  ws.mergeCells(`B${estadoRow}:C${estadoRow}`);
  const estadoLabel = cp?.estado === "cuadrado"
    ? "✓ CUADRADO · |diferencia| ≤ tolerancia"
    : cp?.estado === "renta_presunta"
      ? "⚠ APLICA RENTA POR COMPARACIÓN PATRIMONIAL"
      : "— NO APLICA";
  ws.getCell(`B${estadoRow}`).value = estadoLabel;
  ws.getCell(`B${estadoRow}`).style = stySection();
  ws.getRow(estadoRow).height = 22;
}

// =========================================================================
// HOJA 18 · ANEXO CONCILIACIÓN UTILIDAD
// =========================================================================
function addAnxConciUtil(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.AX_CONCI_UTIL, {
    properties: { tabColor: { argb: DIAN_BLUE_LIGHT } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
  });
  ws.columns = [{ width: 3 }, { width: 50 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 3 }];

  ws.mergeCells("B2:E2");
  ws.getCell("B2").value = "ANEXO 17 · CONCILIACIÓN UTILIDAD CONTABLE → RENTA FISCAL";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.getCell("B4").value = "CONCEPTO"; ws.getCell("B4").style = styColHeader();
  ws.getCell("C4").value = "VALOR"; ws.getCell("C4").style = styColHeader();
  ws.getCell("D4").value = "TIPO"; ws.getCell("D4").style = styColHeader();
  ws.getCell("E4").value = "NORMA"; ws.getCell("E4").style = styColHeader();
  ws.getRow(4).height = 22;

  const cu = d.concUtilidad;
  type Movimiento = { concepto: string; valor: number; tipo: string; norma: string };

  const filas: Movimiento[] = [
    {
      concepto: "Utilidad contable antes de impuestos",
      valor: Number(cu?.utilidadContableTotal ?? 0),
      tipo: "Base",
      norma: "—",
    },
    ...(cu?.partidas ?? []).map((p) => ({
      concepto: p.concepto,
      valor: p.signo === "mas" ? Number(p.valor) : -Number(p.valor),
      tipo: `${p.signo === "mas" ? "(+)" : "(−)"} ${p.categoria}`,
      norma: p.fuente ?? p.observacion ?? "—",
    })),
  ];

  filas.forEach((f, i) => {
    const ri = 5 + i;
    ws.getCell(`B${ri}`).value = f.concepto; ws.getCell(`B${ri}`).style = i === 0 ? styLabelBold() : styLabel();
    ws.getCell(`C${ri}`).value = f.valor; ws.getCell(`C${ri}`).style = i === 0 ? styMoneyTotal() : styMoney();
    ws.getCell(`D${ri}`).value = f.tipo; ws.getCell(`D${ri}`).style = styLabel();
    ws.getCell(`E${ri}`).value = f.norma; ws.getCell(`E${ri}`).style = styLabel();
  });
  const tot = 5 + filas.length;
  ws.getCell(`B${tot}`).value = "= RENTA LÍQUIDA FISCAL CALCULADA"; ws.getCell(`B${tot}`).style = stySection();
  ws.getCell(`C${tot}`).value = { formula: `SUM(C5:C${tot - 1})` } as ExcelJS.CellFormulaValue;
  ws.getCell(`C${tot}`).style = styMoneyTotal();

  // Estado de cuadre
  const tot2 = tot + 2;
  ws.mergeCells(`B${tot2}:E${tot2}`);
  ws.getCell(`B${tot2}`).value = `Estado: ${cu?.estado ?? "—"} · Δ vs R72: ${Number(cu?.cuadres?.vsR72?.diferencia ?? 0).toLocaleString("es-CO")} · Δ vs R79: ${Number(cu?.cuadres?.vsR79?.diferencia ?? 0).toLocaleString("es-CO")}`;
  ws.getCell(`B${tot2}`).style = stySection();
}

// =========================================================================
// HOJA 19 · ANEXO RENTA PRESUNTIVA
// =========================================================================
function addAnxRentaPresuntiva(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.AX_RP, {
    properties: { tabColor: { argb: DIAN_BLUE_LIGHT } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 55 }, { width: 20 }, { width: 3 }];

  ws.mergeCells("B2:C2");
  ws.getCell("B2").value = "ANEXO 1 · RENTA PRESUNTIVA";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:C3");
  ws.getCell("B3").value = "Art. 188 E.T. · Base = Patrimonio líquido año anterior − exclusiones · Tarifa AG 2025 = 0%";
  ws.getCell("B3").style = stySubBanner();

  const plAnt =
    Number(d.declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(d.declaracion.pasivos_anterior ?? 0);
  const filas: [string, number | string][] = [
    ["Patrimonio bruto año anterior", Number(d.declaracion.patrimonio_bruto_anterior ?? 0)],
    ["(−) Pasivos año anterior", Number(d.declaracion.pasivos_anterior ?? 0)],
    ["(=) Patrimonio líquido año anterior", plAnt],
    ["(−) Acciones en sociedades nacionales", Number(d.declaracion.rp_acciones_sociedades_nacionales ?? 0)],
    ["(−) Bienes en actividades improductivas", Number(d.declaracion.rp_bienes_actividades_improductivas ?? 0)],
    ["(−) Bienes afectados por fuerza mayor", Number(d.declaracion.rp_bienes_fuerza_mayor ?? 0)],
    ["(−) Bienes en periodo improductivo", Number(d.declaracion.rp_bienes_periodo_improductivo ?? 0)],
    ["(−) Bienes destinados a minería", Number(d.declaracion.rp_bienes_mineria ?? 0)],
    ["(−) Primeros 19.000 UVT vivienda", Number(d.declaracion.rp_primeros_19000_uvt_vivienda ?? 0)],
    ["(=) Base gravable presuntiva", ""],
    ["Tarifa de renta presuntiva (AG 2025)", 0],
    ["(=) Renta presuntiva calculada", ""],
    ["(+) Renta gravada de bienes excluidos", Number(d.declaracion.rp_renta_gravada_bienes_excluidos ?? 0)],
    ["RENTA PRESUNTIVA TOTAL", ""],
  ];
  filas.forEach((f, i) => {
    const ri = 5 + i;
    ws.getCell(`B${ri}`).value = f[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    if (i === 9) {
      ws.getCell(`C${ri}`).value = { formula: `C${ri - 7}-SUM(C${ri - 6}:C${ri - 1})` } as ExcelJS.CellFormulaValue;
    } else if (i === 10) {
      ws.getCell(`C${ri}`).value = f[1] as number; ws.getCell(`C${ri}`).style = { ...styMoneyInput(), numFmt: FMT_PCT };
    } else if (i === 11) {
      ws.getCell(`C${ri}`).value = { formula: `C${ri - 2}*C${ri - 1}` } as ExcelJS.CellFormulaValue;
    } else if (i === 13) {
      ws.getCell(`C${ri}`).value = { formula: `C${ri - 2}+C${ri - 1}` } as ExcelJS.CellFormulaValue;
    } else {
      ws.getCell(`C${ri}`).value = f[1] as number;
    }
    if (i !== 10) ws.getCell(`C${ri}`).style = i === 13 || i === 11 || i === 9 ? styMoneyTotal() : styMoney();
  });

  // Comparación con renta líquida ordinaria
  const ri = 5 + filas.length + 2;
  ws.mergeCells(`B${ri}:C${ri}`);
  ws.getCell(`B${ri}`).value = "COMPARACIÓN · La renta gravable es el MAYOR entre renta líquida ordinaria y renta presuntiva.";
  ws.getCell(`B${ri}`).style = stySection();
}

// =========================================================================
// HOJA 20 · ANEXO RETENCIONES + ANTICIPO
// =========================================================================
function addAnxRetenciones(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.AX_RET, {
    properties: { tabColor: { argb: DIAN_BLUE_LIGHT } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 55 }, { width: 20 }, { width: 3 }];

  ws.mergeCells("B2:C2");
  ws.getCell("B2").value = "ANEXO 3 · RETENCIONES Y AUTORRETENCIÓN + ANTICIPO";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  const filas: [string, number][] = [
    ["Total retenciones en la fuente (Anexo 3)", Number(d.anexosCtx.totalRetenciones ?? 0)],
    ["Total autorretenciones (Anexo 3)", Number(d.anexosCtx.totalAutorretenciones ?? 0)],
    ["Suma retenciones (R104 F-110)", 0],
    ["Anticipo para el año actual (R105 F-110)", Number(d.declaracion.anticipo_para_actual ?? 0)],
    ["Saldo a favor año anterior", Number(d.declaracion.saldo_favor_anterior ?? 0)],
    ["Anticipo año siguiente calculado (R102 F-110)", Number(d.numerico?.get(102) ?? 0)],
  ];
  filas.forEach((f, i) => {
    const ri = 5 + i;
    ws.getCell(`B${ri}`).value = f[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    if (i === 2) {
      ws.getCell(`C${ri}`).value = { formula: `C${ri - 2}+C${ri - 1}` } as ExcelJS.CellFormulaValue;
      ws.getCell(`C${ri}`).style = styMoneyTotal();
    } else {
      ws.getCell(`C${ri}`).value = f[1];
      ws.getCell(`C${ri}`).style = styMoney();
    }
  });
}

// =========================================================================
// HOJA 21 · ANEXO ACTIVOS FIJOS
// =========================================================================
function addAnxActivosFijos(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.AX_AF, {
    properties: { tabColor: { argb: DIAN_BLUE_LIGHT } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 35 }, { width: 16 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 3 }];

  ws.mergeCells("B2:G2");
  ws.getCell("B2").value = "ANEXO 5 · VENTA Y DEPRECIACIÓN DE ACTIVOS FIJOS";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:G3");
  ws.getCell("B3").value = "Detalle por categoría · vida útil fiscal · depreciación acumulada (cruza con H6)";
  ws.getCell("B3").style = stySubBanner();

  const hdrs = ["Activo / Categoría", "Costo histórico", "Vida útil", "Dep. ejercicio", "Dep. acumulada", "Valor neto fiscal"];
  hdrs.forEach((h, i) => {
    const c = String.fromCharCode("B".charCodeAt(0) + i);
    ws.getCell(`${c}5`).value = h; ws.getCell(`${c}5`).style = styColHeader();
  });
  ws.getRow(5).height = 28;

  const cats: [string, number][] = [
    ["Construcciones y edificaciones", 45],
    ["Maquinaria y equipo", 10],
    ["Equipo de oficina", 5],
    ["Equipo de cómputo", 3],
    ["Flota y equipo de transporte", 5],
    ["Otros activos fijos", 10],
  ];
  cats.forEach((c, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = c[0]; ws.getCell(`B${ri}`).style = styLabel();
    ws.getCell(`C${ri}`).value = 0; ws.getCell(`C${ri}`).style = styMoneyInput();
    ws.getCell(`D${ri}`).value = c[1]; ws.getCell(`D${ri}`).style = { ...styLabel(), alignment: { vertical: "middle", horizontal: "center" } };
    ws.getCell(`E${ri}`).value = { formula: `C${ri}/D${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = styMoney();
    ws.getCell(`F${ri}`).value = 0; ws.getCell(`F${ri}`).style = styMoneyInput();
    ws.getCell(`G${ri}`).value = { formula: `C${ri}-F${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`G${ri}`).style = styMoneyTotal();
  });
}

// =========================================================================
// HOJA 22 · ANEXO NÓMINA SEGURIDAD SOCIAL
// =========================================================================
function addAnxNominaSS(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.AX_NOMINA, {
    properties: { tabColor: { argb: DIAN_BLUE_LIGHT } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 50 }, { width: 20 }, { width: 3 }];

  ws.mergeCells("B2:C2");
  ws.getCell("B2").value = "ANEXO 21 · PAGOS SEGURIDAD SOCIAL";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  const filas: [string, number][] = [
    ["Salarios pagados", 0],
    ["Aportes a salud (8.5%)", 0],
    ["Aportes a pensión (12%)", 0],
    ["Aportes ARL", 0],
    ["Aportes parafiscales (SENA/ICBF/Cajas)", 0],
    ["Caja de compensación familiar", 0],
    ["Cesantías + intereses", 0],
    ["Prima legal de servicios", 0],
    ["Vacaciones", 0],
    ["Total carga prestacional", 0],
  ];
  filas.forEach((f, i) => {
    const ri = 5 + i;
    ws.getCell(`B${ri}`).value = f[0]; ws.getCell(`B${ri}`).style = i === filas.length - 1 ? styLabelBold() : styLabel();
    if (i === filas.length - 1) {
      ws.getCell(`C${ri}`).value = { formula: `SUM(C5:C${ri - 1})` } as ExcelJS.CellFormulaValue;
      ws.getCell(`C${ri}`).style = styMoneyTotal();
    } else {
      ws.getCell(`C${ri}`).value = f[1]; ws.getCell(`C${ri}`).style = styMoneyInput();
    }
  });
}

// =========================================================================
// HOJA 23 · ANEXO PÉRDIDAS FISCALES
// =========================================================================
function addAnxPerdidasFisc(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.AX_PERDIDAS, {
    properties: { tabColor: { argb: DIAN_BLUE_LIGHT } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 18 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 3 }];

  ws.mergeCells("B2:E2");
  ws.getCell("B2").value = "ANEXO 20 · COMPENSACIÓN DE PÉRDIDAS FISCALES";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:E3");
  ws.getCell("B3").value = "Art. 147 E.T. · Compensación hasta 12 años · ajustadas por reajuste fiscal";
  ws.getCell("B3").style = stySubBanner();

  ws.getCell("B5").value = "AÑO ORIGEN"; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "PÉRDIDA ORIGINAL"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "REAJUSTE FISCAL"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "PÉRDIDA AJUSTADA"; ws.getCell("E5").style = styColHeader();
  ws.getRow(5).height = 24;

  const anos = ["2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"];
  anos.forEach((a, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = a; ws.getCell(`B${ri}`).style = { ...styLabel(), alignment: { vertical: "middle", horizontal: "center" } };
    ws.getCell(`C${ri}`).value = 0; ws.getCell(`C${ri}`).style = styMoneyInput();
    ws.getCell(`D${ri}`).value = 0; ws.getCell(`D${ri}`).style = styMoneyInput();
    ws.getCell(`E${ri}`).value = { formula: `C${ri}+D${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = styMoney();
  });
  const tot = 6 + anos.length;
  ws.getCell(`B${tot}`).value = "TOTAL"; ws.getCell(`B${tot}`).style = stySection();
  ["C", "D", "E"].forEach((c) => {
    ws.getCell(`${c}${tot}`).value = { formula: `SUM(${c}6:${c}${tot - 1})` } as ExcelJS.CellFormulaValue;
    ws.getCell(`${c}${tot}`).style = styMoneyTotal();
  });
}

// =========================================================================
// HOJA 24 · LIQUIDACIÓN PRIVADA
// =========================================================================
function addLiquidacionPrivada(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.LIQUID, {
    properties: { tabColor: { argb: DIAN_BLUE_DEEP } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 55 }, { width: 20 }, { width: 3 }];

  ws.mergeCells("B2:C2");
  ws.getCell("B2").value = "LIQUIDACIÓN PRIVADA · CÁLCULO FINAL DEL IMPUESTO";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:C3");
  ws.getCell("B3").value = "Cálculo final · renta líquida → impuesto a cargo → descuentos → saldo a pagar";
  ws.getCell("B3").style = stySubBanner();

  const n = d.numerico;
  const get = (k: number) => Number(n?.get(k) ?? 0);
  const filas: [string, number, string][] = [
    ["Renta líquida gravable (R79)", get(79), styMoneyTotal.name],
    ["× Tarifa nominal", d.tarifaRegimen, "pct"],
    ["= Impuesto sobre renta líquida (R86)", get(86), styMoneyTotal.name],
    ["(+) Impuesto ganancia ocasional (R90)", get(90), ""],
    ["(+) Impuesto adicional Tasa Mínima TTD", get(95), ""],
    ["(=) Total impuesto a cargo (R99)", get(99), styMoneyTotal.name],
    ["(−) Descuentos tributarios (R98)", get(98), ""],
    ["(=) Impuesto neto de renta (R100)", get(100), styMoneyTotal.name],
    ["(−) Retenciones del año (R104)", get(104), ""],
    ["(−) Anticipo del año anterior (R105)", get(105), ""],
    ["(−) Saldo a favor del año anterior (R107)", get(107), ""],
    ["(+) Anticipo del año siguiente (R102)", get(102), ""],
    ["(+) Sanciones (R111)", get(111), ""],
    ["TOTAL SALDO A PAGAR (R113)", get(113), styMoneyTotal.name],
    ["TOTAL SALDO A FAVOR (R114)", get(114), styMoneyTotal.name],
  ];
  filas.forEach((f, i) => {
    const ri = 5 + i;
    ws.getCell(`B${ri}`).value = f[0]; ws.getCell(`B${ri}`).style = styLabelBold();
    if (f[2] === "pct") {
      ws.getCell(`C${ri}`).value = f[1];
      ws.getCell(`C${ri}`).style = { ...styMoney(), numFmt: FMT_PCT };
    } else {
      ws.getCell(`C${ri}`).value = f[1];
      ws.getCell(`C${ri}`).style = f[2] === styMoneyTotal.name ? styMoneyTotal() : styMoney();
    }
  });
}

// =========================================================================
// HOJA 25 · FORMULARIO 110
// =========================================================================
function addFormulario110(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.FORM110, {
    properties: { tabColor: { argb: DIAN_BLUE_DEEP } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [{ width: 3 }, { width: 8 }, { width: 50 }, { width: 18 }, { width: 18 }, { width: 3 }];

  ws.mergeCells("B2:E2");
  ws.getCell("B2").value = "FORMULARIO 110 · DECLARACIÓN DE RENTA AG " + d.declaracion.ano_gravable;
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:E3");
  ws.getCell("B3").value = `${d.empresa.razon_social} · NIT ${d.empresa.nit}-${d.empresa.dv ?? ""} · Tarifa ${(d.tarifaRegimen * 100).toFixed(0)}%`;
  ws.getCell("B3").style = stySubBanner();

  ws.getCell("B5").value = "REN."; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "CONCEPTO"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "VALOR"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "FUENTE"; ws.getCell("E5").style = styColHeader();
  ws.getRow(5).height = 24;

  const renglones = d.renglones ?? [];
  const numerico = d.numerico;
  renglones.forEach((r, i) => {
    const ri = 6 + i;
    const valor = Number(numerico?.get(r.numero) ?? 0);
    ws.getCell(`B${ri}`).value = String(r.numero); ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = r.descripcion; ws.getCell(`C${ri}`).style = styLabel();
    ws.getCell(`D${ri}`).value = valor; ws.getCell(`D${ri}`).style = styMoney();
    ws.getCell(`E${ri}`).value = r.seccion ?? "—"; ws.getCell(`E${ri}`).style = styLabel();
  });
}

// =========================================================================
// HOJA 26 · AUDITORÍA RF
// =========================================================================
function addAuditoriaRF(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.AUDIT_RF, {
    properties: { tabColor: { argb: TRIBAI_GOLD } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 55 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 3 }];

  ws.mergeCells("B2:E2");
  ws.getCell("B2").value = "AUDITORÍA F-110 · CHECKLIST EXTENSO + VALIDACIONES + FIRMA RF";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:E3");
  ws.getCell("B3").value = "Pruebas automatizadas · valor esperado vs valor obtenido · status";
  ws.getCell("B3").style = stySubBanner();

  ws.getCell("B5").value = "PRUEBA"; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "ESPERADO"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "OBTENIDO"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "STATUS"; ws.getCell("E5").style = styColHeader();
  ws.getRow(5).height = 24;

  // Pruebas: ESF (A = P + Pat), totales H7, validaciones del engine
  const pruebas: { nombre: string; esperado: string; obtenido: string }[] = [
    {
      nombre: "Balance cuadra · Suma saldos = 0",
      esperado: "0",
      obtenido: `'${SHEET.BALANCE}'!D${6 + d.balance.length}`,
    },
    {
      nombre: "Sumaria · suma fiscal ≈ suma contable (sin ajustes)",
      esperado: `'${SHEET.SUMARIA}'!D${6 + d.balance.length}`,
      obtenido: `'${SHEET.SUMARIA}'!G${6 + d.balance.length}`,
    },
    {
      nombre: "F-110 R79 = Σ Renta gravable",
      esperado: `'${SHEET.S_RENTA}'!C10`,
      obtenido: `'${SHEET.FORM110}'!D81`,
    },
    {
      nombre: "F-110 R113 + R114 son excluyentes",
      esperado: "0",
      obtenido: `MIN('${SHEET.FORM110}'!D115,'${SHEET.FORM110}'!D116)`,
    },
  ];

  pruebas.forEach((p, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = p.nombre; ws.getCell(`B${ri}`).style = styLabel();
    if (p.esperado.startsWith("'")) {
      ws.getCell(`C${ri}`).value = { formula: p.esperado } as ExcelJS.CellFormulaValue;
    } else {
      ws.getCell(`C${ri}`).value = Number(p.esperado);
    }
    ws.getCell(`C${ri}`).style = styMoney();
    if (p.obtenido.startsWith("'") || p.obtenido.startsWith("MIN") || p.obtenido.startsWith("MAX")) {
      ws.getCell(`D${ri}`).value = { formula: p.obtenido } as ExcelJS.CellFormulaValue;
    } else {
      ws.getCell(`D${ri}`).value = Number(p.obtenido);
    }
    ws.getCell(`D${ri}`).style = styMoney();
    ws.getCell(`E${ri}`).value = { formula: `IF(ABS(D${ri}-C${ri})<1,"✓ OK","✗ DIFERENCIA")` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = { ...styLabel(), alignment: { vertical: "middle", horizontal: "center" }, font: { bold: true, color: { argb: DIAN_BLUE_DEEP }, size: 10 } };
  });

  // Validaciones engine
  const startVal = 6 + pruebas.length + 2;
  ws.mergeCells(`B${startVal}:E${startVal}`);
  ws.getCell(`B${startVal}`).value = `VALIDACIONES DEL MOTOR FISCAL · ${d.validaciones.length} chequeos · ${d.resumenValidaciones.errores} errores · ${d.resumenValidaciones.advertencias} advertencias`;
  ws.getCell(`B${startVal}`).style = stySection();
  ws.getRow(startVal).height = 22;

  d.validaciones.slice(0, 50).forEach((v, i) => {
    const ri = startVal + 1 + i;
    ws.mergeCells(`B${ri}:D${ri}`);
    ws.getCell(`B${ri}`).value = `${v.nivel === "error" ? "✗" : v.nivel === "warn" ? "⚠" : "·"} ${v.mensaje}`;
    ws.getCell(`B${ri}`).style = {
      ...styLabel(),
      font: {
        bold: v.nivel === "error",
        color: { argb: v.nivel === "error" ? "FFB91C1C" : v.nivel === "warn" ? "FFB45309" : TRIBAI_INK },
        size: 9,
      },
    };
    ws.getCell(`E${ri}`).value = v.nivel.toUpperCase();
    ws.getCell(`E${ri}`).style = { ...styLabel(), alignment: { vertical: "middle", horizontal: "center" }, font: { bold: true, size: 9, color: { argb: WHITE } } };
  });

  // Firma RF
  const sFirma = startVal + 2 + Math.min(d.validaciones.length, 50) + 2;
  ws.mergeCells(`B${sFirma}:E${sFirma}`);
  ws.getCell(`B${sFirma}`).value = "FIRMA REVISORÍA FISCAL";
  ws.getCell(`B${sFirma}`).style = stySection();
  ws.getRow(sFirma).height = 22;

  ws.mergeCells(`B${sFirma + 1}:E${sFirma + 1}`);
  ws.getCell(`B${sFirma + 1}`).value =
    "He revisado las pruebas anteriores. Los cuadres que aparecen como ✓ OK fueron verificados; las diferencias quedaron documentadas en notas técnicas adjuntas a este papel de trabajo.";
  ws.getCell(`B${sFirma + 1}`).style = { ...styLabel(), alignment: { vertical: "top", horizontal: "justify", wrapText: true, indent: 1 } };
  ws.getRow(sFirma + 1).height = 50;

  ws.mergeCells(`B${sFirma + 3}:C${sFirma + 3}`);
  ws.getCell(`B${sFirma + 3}`).value = `Firma: ${d.h1?.rf_nombre ?? "____________________"}`;
  ws.getCell(`B${sFirma + 3}`).style = styLabel();
  ws.mergeCells(`D${sFirma + 3}:E${sFirma + 3}`);
  ws.getCell(`D${sFirma + 3}`).value = `T.P.: ${d.h1?.rf_tarjeta_prof ?? "______________"}`;
  ws.getCell(`D${sFirma + 3}`).style = styLabel();
}

// =========================================================================
// HOJA · IMPUESTO DIFERIDO (hoja de cálculo · independiente del H4 oficial)
// =========================================================================
function addImpuestoDiferido(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.IMP_DIF, {
    properties: { tabColor: { argb: DIAN_BLUE_DEEP } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [
    { width: 3 }, { width: 42 },
    { width: 16 }, { width: 16 }, { width: 16 },
    { width: 14 }, { width: 16 }, { width: 16 }, { width: 3 },
  ];

  ws.mergeCells("B2:H2");
  ws.getCell("B2").value = "IMPUESTO DIFERIDO · DETALLE ATD / PTD POR DIFERENCIA TEMPORARIA";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;

  ws.mergeCells("B3:H3");
  ws.getCell("B3").value = "Hoja de cálculo (NIC 12 · Art. 290 E.T.) · alimenta el formato F-2516 H4 oficial";
  ws.getCell("B3").style = stySubBanner();

  const hdrs = ["Categoría / partida", "Base contable", "Base fiscal", "Diferencia", "Tarifa", "ATD", "PTD"];
  hdrs.forEach((h, i) => {
    const c = String.fromCharCode("B".charCodeAt(0) + i);
    ws.getCell(`${c}5`).value = h; ws.getCell(`${c}5`).style = styColHeader();
  });
  ws.getRow(5).height = 28;

  const cats = d.h4?.filas?.length
    ? d.h4.filas.map((f) => f.categoria.concepto)
    : [
      "Efectivo y equivalentes", "Inversiones", "Cuentas por cobrar", "Inventarios",
      "Propiedad planta y equipo", "Intangibles", "Propiedades de inversión",
      "Activos biológicos", "ANCMV", "Pasivos financieros", "Impuestos por pagar",
      "Beneficios empleados", "Provisiones", "Otros pasivos", "Operaciones títulos",
      "Pérdidas fiscales", "Activos solo fiscales", "Otros",
    ];

  cats.forEach((nombre, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = nombre; ws.getCell(`B${ri}`).style = styLabel();
    ws.getCell(`C${ri}`).value = 0; ws.getCell(`C${ri}`).style = styMoneyInput();
    ws.getCell(`D${ri}`).value = 0; ws.getCell(`D${ri}`).style = styMoneyInput();
    ws.getCell(`E${ri}`).value = { formula: `D${ri}-C${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = styMoney();
    ws.getCell(`F${ri}`).value = d.tarifaRegimen;
    ws.getCell(`F${ri}`).style = { ...styMoneyInput(), numFmt: FMT_PCT };
    ws.getCell(`G${ri}`).value = { formula: `IF(E${ri}>0,E${ri}*F${ri},0)` } as ExcelJS.CellFormulaValue;
    ws.getCell(`G${ri}`).style = styMoney();
    ws.getCell(`H${ri}`).value = { formula: `IF(E${ri}<0,-E${ri}*F${ri},0)` } as ExcelJS.CellFormulaValue;
    ws.getCell(`H${ri}`).style = styMoney();
  });

  const tot = 6 + cats.length;
  ws.getCell(`B${tot}`).value = "TOTAL"; ws.getCell(`B${tot}`).style = stySection();
  ["C", "D", "E", "G", "H"].forEach((c) => {
    ws.getCell(`${c}${tot}`).value = { formula: `SUM(${c}6:${c}${tot - 1})` } as ExcelJS.CellFormulaValue;
    ws.getCell(`${c}${tot}`).style = styMoneyTotal();
  });

  // Resumen neto
  const sR = tot + 2;
  ws.mergeCells(`B${sR}:H${sR}`);
  ws.getCell(`B${sR}`).value = "RESUMEN · ATD − PTD = IMPUESTO DIFERIDO NETO"; ws.getCell(`B${sR}`).style = stySection();
  ws.getRow(sR).height = 22;
  ws.getCell(`B${sR + 1}`).value = "Total ATD (impuesto diferido activo)"; ws.getCell(`B${sR + 1}`).style = styLabelBold();
  ws.getCell(`G${sR + 1}`).value = { formula: `G${tot}` } as ExcelJS.CellFormulaValue; ws.getCell(`G${sR + 1}`).style = styMoneyTotal();
  ws.getCell(`B${sR + 2}`).value = "Total PTD (impuesto diferido pasivo)"; ws.getCell(`B${sR + 2}`).style = styLabelBold();
  ws.getCell(`G${sR + 2}`).value = { formula: `H${tot}` } as ExcelJS.CellFormulaValue; ws.getCell(`G${sR + 2}`).style = styMoneyTotal();
  ws.getCell(`B${sR + 3}`).value = "IMPUESTO DIFERIDO NETO (ATD − PTD)"; ws.getCell(`B${sR + 3}`).style = stySection();
  ws.getCell(`G${sR + 3}`).value = { formula: `G${sR + 1}-G${sR + 2}` } as ExcelJS.CellFormulaValue; ws.getCell(`G${sR + 3}`).style = styMoneyTotal();
}

// =========================================================================
// HOJA · TASA MÍNIMA - TTD (Art. 240 par. 6 E.T. · Ley 2277/2022)
// =========================================================================
function addTasaMinima(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.TASA_MIN, {
    properties: { tabColor: { argb: TRIBAI_GOLD } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 60 }, { width: 22 }, { width: 14 }, { width: 3 }];

  ws.mergeCells("B2:D2");
  ws.getCell("B2").value = "TASA MÍNIMA DE TRIBUTACIÓN (TTD) · Art. 240 par. 6 E.T.";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:D3");
  ws.getCell("B3").value = "Ley 2277/2022 · garantiza tarifa efectiva mínima del 15% sobre la utilidad depurada (TTD = ID/UD)";
  ws.getCell("B3").style = stySubBanner();

  const n = d.numerico;
  const get = (k: number) => Number(n?.get(k) ?? 0);

  const filas: { concepto: string; valor: number | string; norma?: string; tipo?: "input" | "calc" | "total" }[] = [
    { concepto: "Utilidad contable neta del ejercicio", valor: 0, norma: "Insumo balance", tipo: "input" },
    { concepto: "(+) Diferencias permanentes que aumentan", valor: 0, norma: "Art. 240 par. 6.1", tipo: "input" },
    { concepto: "(=) Utilidad depurada (UD)", valor: "", norma: "UD = UCN + DPA", tipo: "calc" },
    { concepto: "Impuesto neto de renta sobre renta líquida (R94)", valor: get(94), norma: "F-110 R94", tipo: "calc" },
    { concepto: "(+) Descuentos tributarios aplicados (R98)", valor: get(98), norma: "F-110 R98", tipo: "calc" },
    { concepto: "(+) Impuesto sobre ganancia ocasional (R90)", valor: get(90), norma: "F-110 R90", tipo: "calc" },
    { concepto: "(=) Impuesto depurado (ID)", valor: "", norma: "ID = R94 + R98 + R90", tipo: "calc" },
    { concepto: "Tasa Efectiva de Tributación (TTD) = ID / UD", valor: "", norma: "Comparada vs 15%", tipo: "calc" },
    { concepto: "Tasa mínima Art. 240 par. 6 (Ley 2277)", valor: 0.15, norma: "—", tipo: "calc" },
    { concepto: "Impuesto adicional para llegar al 15% (R95)", valor: get(95), norma: "F-110 R95", tipo: "total" },
  ];

  filas.forEach((f, i) => {
    const ri = 5 + i;
    ws.getCell(`B${ri}`).value = f.concepto;
    ws.getCell(`B${ri}`).style = f.tipo === "total" ? stySection() : styLabelBold();
    if (typeof f.valor === "number") {
      ws.getCell(`C${ri}`).value = f.valor;
      const isPct = f.concepto.startsWith("Tasa mínima") || f.concepto.startsWith("Tasa Efectiva");
      ws.getCell(`C${ri}`).style = isPct
        ? { ...styMoney(), numFmt: FMT_PCT }
        : f.tipo === "input"
          ? styMoneyInput()
          : f.tipo === "total"
            ? styMoneyTotal()
            : styMoney();
    } else if (i === 2) {
      ws.getCell(`C${ri}`).value = { formula: `C${ri - 2}+C${ri - 1}` } as ExcelJS.CellFormulaValue;
      ws.getCell(`C${ri}`).style = styMoneyTotal();
    } else if (i === 6) {
      ws.getCell(`C${ri}`).value = { formula: `C${ri - 3}+C${ri - 2}+C${ri - 1}` } as ExcelJS.CellFormulaValue;
      ws.getCell(`C${ri}`).style = styMoneyTotal();
    } else if (i === 7) {
      ws.getCell(`C${ri}`).value = { formula: `IFERROR(C${ri - 1}/C${ri - 5},0)` } as ExcelJS.CellFormulaValue;
      ws.getCell(`C${ri}`).style = { ...styMoneyTotal(), numFmt: FMT_PCT };
    }
    if (f.norma) {
      ws.getCell(`D${ri}`).value = f.norma;
      ws.getCell(`D${ri}`).style = { ...styLabel(), font: { color: { argb: "FF666666" }, size: 9, name: "Calibri" } };
    }
  });

  // Veredicto
  const sV = 5 + filas.length + 2;
  ws.mergeCells(`B${sV}:D${sV}`);
  ws.getCell(`B${sV}`).value = "VEREDICTO · Si TTD < 15% se adiciona R95 hasta cumplir el piso (cálculo automático en F-110)";
  ws.getCell(`B${sV}`).style = stySection();
  ws.getRow(sV).height = 28;
}

// =========================================================================
// HOJA · F110_2516 · CRUCE F-110 ↔ F-2516 H7
// =========================================================================
function addF110_2516(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.F110_2516, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [
    { width: 3 }, { width: 8 }, { width: 55 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }, { width: 3 },
  ];

  ws.mergeCells("B2:G2");
  ws.getCell("B2").value = "CRUCE F-110 ↔ F-2516 H7 · CONCILIACIÓN DE TOTALES";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:G3");
  ws.getCell("B3").value = "Renglón F-110 vs total equivalente en F-2516 H7 · diferencia debe ser 0";
  ws.getCell("B3").style = stySubBanner();

  const hdrs = ["REN.", "Concepto", "F-110", "F-2516 H7", "Diferencia", "Estado"];
  hdrs.forEach((h, i) => {
    const c = String.fromCharCode("B".charCodeAt(0) + i);
    ws.getCell(`${c}5`).value = h; ws.getCell(`${c}5`).style = styColHeader();
  });
  ws.getRow(5).height = 24;

  const n = d.numerico;
  const get = (k: number) => Number(n?.get(k) ?? 0);

  // Map: renglón F-110 ↔ fila aproximada en H7 (los H7 rows dependen de catalogo)
  const cruces: { ren: number; concepto: string; valor: number; h7Ref: string }[] = [
    { ren: 32, concepto: "Total Patrimonio Bruto", valor: get(32), h7Ref: "C6" },
    { ren: 33, concepto: "Total Pasivos", valor: get(33), h7Ref: "C7" },
    { ren: 46, concepto: "Patrimonio Líquido", valor: get(46), h7Ref: "C8" },
    { ren: 58, concepto: "Total ingresos brutos", valor: get(58), h7Ref: "C9" },
    { ren: 67, concepto: "Total costos y gastos deducibles", valor: get(67), h7Ref: "C10" },
    { ren: 76, concepto: "Renta líquida ordinaria", valor: get(76), h7Ref: "C11" },
    { ren: 79, concepto: "Renta líquida gravable", valor: get(79), h7Ref: "C11" },
  ];

  cruces.forEach((c, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = String(c.ren); ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = c.concepto; ws.getCell(`C${ri}`).style = styLabel();
    ws.getCell(`D${ri}`).value = { formula: `'${SHEET.FORM110}'!D${c.ren - 23}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`D${ri}`).style = styMoney();
    ws.getCell(`E${ri}`).value = { formula: `'${SHEET.H7}'!${c.h7Ref}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = styMoney();
    ws.getCell(`F${ri}`).value = { formula: `D${ri}-E${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`F${ri}`).style = styMoneyTotal();
    ws.getCell(`G${ri}`).value = { formula: `IF(ABS(F${ri})<1,"✓ OK","✗ DIF")` } as ExcelJS.CellFormulaValue;
    ws.getCell(`G${ri}`).style = { ...styLabel(), alignment: { vertical: "middle", horizontal: "center" }, font: { bold: true, color: { argb: DIAN_BLUE_DEEP }, size: 10 } };
  });
}

// =========================================================================
// HOJA · F110_Conciliación · CONTABLE ↔ FISCAL
// =========================================================================
function addF110_Conciliacion(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.F110_CONCI, {
    properties: { tabColor: { argb: DIAN_BLUE } },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5 }],
  });
  ws.columns = [
    { width: 3 }, { width: 8 }, { width: 50 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 3 },
  ];

  ws.mergeCells("B2:G2");
  ws.getCell("B2").value = "F-110 · CONCILIACIÓN CONTABLE ↔ FISCAL · PARTIDA POR PARTIDA";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:G3");
  ws.getCell("B3").value = "Renglón F-110 · contable (Σ desde Balance) vs fiscal (valor declarado) · diferencias explicadas";
  ws.getCell("B3").style = stySubBanner();

  const hdrs = ["REN.", "Concepto", "Contable", "Fiscal F-110", "Diferencia", "Tipo"];
  hdrs.forEach((h, i) => {
    const c = String.fromCharCode("B".charCodeAt(0) + i);
    ws.getCell(`${c}5`).value = h; ws.getCell(`${c}5`).style = styColHeader();
  });
  ws.getRow(5).height = 24;

  const n = d.numerico;
  const get = (k: number) => Number(n?.get(k) ?? 0);

  const partidas: { ren: number; concepto: string }[] = [
    { ren: 32, concepto: "Patrimonio Bruto" },
    { ren: 33, concepto: "Pasivos" },
    { ren: 46, concepto: "Patrimonio Líquido" },
    { ren: 47, concepto: "Ingresos brutos operacionales" },
    { ren: 48, concepto: "Ingresos brutos no operacionales" },
    { ren: 49, concepto: "Intereses y rendimientos financieros" },
    { ren: 58, concepto: "Total ingresos brutos" },
    { ren: 59, concepto: "Devoluciones, rebajas, descuentos en ventas" },
    { ren: 64, concepto: "Costo de ventas y de servicios" },
    { ren: 67, concepto: "Total costos y deducciones" },
    { ren: 72, concepto: "Renta líquida del ejercicio" },
    { ren: 76, concepto: "Renta líquida ordinaria" },
    { ren: 79, concepto: "Renta líquida gravable" },
  ];

  partidas.forEach((p, i) => {
    const ri = 6 + i;
    const valFiscal = get(p.ren);
    ws.getCell(`B${ri}`).value = String(p.ren); ws.getCell(`B${ri}`).style = styRenglon();
    ws.getCell(`C${ri}`).value = p.concepto; ws.getCell(`C${ri}`).style = styLabel();
    ws.getCell(`D${ri}`).value = 0; ws.getCell(`D${ri}`).style = styMoneyInput();
    ws.getCell(`E${ri}`).value = valFiscal; ws.getCell(`E${ri}`).style = styMoney();
    ws.getCell(`F${ri}`).value = { formula: `E${ri}-D${ri}` } as ExcelJS.CellFormulaValue;
    ws.getCell(`F${ri}`).style = styMoneyTotal();
    ws.getCell(`G${ri}`).value = { formula: `IF(ABS(F${ri})<1,"·",IF(F${ri}>0,"Permanente +","Permanente −"))` } as ExcelJS.CellFormulaValue;
    ws.getCell(`G${ri}`).style = { ...styLabel(), alignment: { vertical: "middle", horizontal: "center" } };
  });
}

// =========================================================================
// HOJA · Audi_F-110 · CHECKLIST LIVIANO (pruebas críticas resumidas)
// =========================================================================
function addAudiF110(wb: ExcelJS.Workbook, d: PapelTrabajoRFData) {
  const ws = wb.addWorksheet(SHEET.AUDI_F110, {
    properties: { tabColor: { argb: TRIBAI_GOLD } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 3 }, { width: 55 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 3 }];

  ws.mergeCells("B2:E2");
  ws.getCell("B2").value = "Audi_F-110 · CHECKLIST LIVIANO DE CUADRES CRÍTICOS";
  ws.getCell("B2").style = styBannerDIAN();
  ws.getRow(2).height = 28;
  ws.mergeCells("B3:E3");
  ws.getCell("B3").value = "Vista compacta · 6 pruebas críticas · semáforo OK/DIF para revisión rápida";
  ws.getCell("B3").style = stySubBanner();

  ws.getCell("B5").value = "PRUEBA"; ws.getCell("B5").style = styColHeader();
  ws.getCell("C5").value = "ESPERADO"; ws.getCell("C5").style = styColHeader();
  ws.getCell("D5").value = "OBTENIDO"; ws.getCell("D5").style = styColHeader();
  ws.getCell("E5").value = "STATUS"; ws.getCell("E5").style = styColHeader();
  ws.getRow(5).height = 22;

  const n = d.numerico;
  const get = (k: number) => Number(n?.get(k) ?? 0);

  const pruebas: { nombre: string; esp: string | number; obt: string | number }[] = [
    { nombre: "ESF · Activos = Pasivos + Patrimonio", esp: get(32), obt: get(33) + get(46) },
    { nombre: "Ingresos − costos = Renta líquida (R67 base)", esp: get(58) - get(67), obt: get(72) },
    { nombre: "Impuesto R94 = R79 × tarifa", esp: Math.round(get(79) * d.tarifaRegimen), obt: get(94) },
    { nombre: "Total impuesto a cargo R99 = R94+R95+R98+R90 ajustes", esp: get(99), obt: get(94) + get(95) + get(98) + get(90) },
    { nombre: "Saldo a pagar/favor mutuamente excluyentes (R113·R114=0)", esp: 0, obt: Math.min(get(113), get(114)) },
    { nombre: "TTD ≥ 15% (impuesto adicional R95 ≥ 0)", esp: 0, obt: get(95) },
  ];

  pruebas.forEach((p, i) => {
    const ri = 6 + i;
    ws.getCell(`B${ri}`).value = p.nombre; ws.getCell(`B${ri}`).style = styLabel();
    ws.getCell(`C${ri}`).value = Number(p.esp); ws.getCell(`C${ri}`).style = styMoney();
    ws.getCell(`D${ri}`).value = Number(p.obt); ws.getCell(`D${ri}`).style = styMoney();
    ws.getCell(`E${ri}`).value = { formula: `IF(ABS(D${ri}-C${ri})<1,"✓ OK","✗ DIFERENCIA")` } as ExcelJS.CellFormulaValue;
    ws.getCell(`E${ri}`).style = { ...styLabel(), alignment: { vertical: "middle", horizontal: "center" }, font: { bold: true, color: { argb: DIAN_BLUE_DEEP }, size: 10 } };
  });

  // Pie · referencia a hoja completa
  const sP = 6 + pruebas.length + 2;
  ws.mergeCells(`B${sP}:E${sP}`);
  ws.getCell(`B${sP}`).value = "Para validaciones extensas y firma del Revisor Fiscal, ver hoja Auditoría_F-110.";
  ws.getCell(`B${sP}`).style = stySection();
  ws.getRow(sP).height = 22;
}
