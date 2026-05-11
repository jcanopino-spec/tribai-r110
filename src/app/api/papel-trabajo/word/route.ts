// GET /api/papel-trabajo/word?decl={id}
//
// Genera un papel de trabajo técnico-gerencial en formato Word (HTML que
// Office abre como documento). Incluye:
//
//   1. Portada Tribai con identidad de marca
//   2. Resumen ejecutivo (KPIs · saldo · alertas)
//   3. Datos del contribuyente (H1 F2516)
//   4. Marco normativo aplicable
//   5. Cálculo del Formulario 110 renglón por renglón
//   6. Conciliación de utilidad (NIC 12 + subcategorías Aries)
//   7. Conciliación patrimonial (Art. 236)
//   8. F2516 H1-H7 oficial DIAN
//   9. Anexos consolidados
//   10. Validaciones cruzadas V1-V18
//   11. Recomendaciones del asesor
//   12. Firmas
//
// La info viene 100% en vivo · cada descarga refleja el estado más reciente.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPapelTrabajoData } from "@/lib/papel-trabajo-data";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const $ = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(Number(n))
    ? "$ 0"
    : `$ ${FMT.format(Math.round(Number(n)))}`;

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
    console.error("[papel-trabajo/word] auth failed:", authError?.message, "url:", req.url);
    // Si la sesión expiró, redirigir a login (mejor UX que un 401 JSON).
    // El navegador completará el flujo y el usuario puede volver a hacer click.
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(new URL(req.url).pathname + new URL(req.url).search)}`, req.url),
    );
  }

  let data;
  try {
    data = await loadPapelTrabajoData(supabase, declId);
  } catch (e) {
    const err = e as Error;
    console.error("[papel-trabajo/word] loader error:", err.message, err.stack);
    return NextResponse.json(
      {
        error: "Error al cargar",
        detalle: err.message,
        stack: err.stack?.split("\n").slice(0, 8).join("\n"),
      },
      { status: 500 },
    );
  }

  let html: string;
  try {
    html = buildHtml(data);
  } catch (e) {
    const err = e as Error;
    console.error("[papel-trabajo/word] build error:", err.message, err.stack);
    return NextResponse.json(
      {
        error: "Build failed",
        detalle: err.message,
        stack: err.stack?.split("\n").slice(0, 8).join("\n"),
      },
      { status: 500 },
    );
  }

  const filename = `Tribai_PapelTrabajo_${slug(data.empresa.razon_social)}_AG${data.declaracion.ano_gravable}.doc`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
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
// BUILDER HTML/Word
// ============================================================
function buildHtml(d: Awaited<ReturnType<typeof loadPapelTrabajoData>>): string {
  const { declaracion, empresa, valoresF110, h1, h7, concUtilidad, concPatrimonial, anexosCtx, validaciones, resumenValidaciones: rvBase } = d;
  // Normalizar el resumen a las propiedades usadas en este builder
  const totalReglas = validaciones.length;
  const okCount = validaciones.filter((x) => x.nivel === "info" || (x as { nivel: string }).nivel === "ok").length;
  const rv = {
    total: totalReglas,
    errores: rvBase.errores,
    warnings: rvBase.advertencias,
    ok: totalReglas - rvBase.errores - rvBase.advertencias,
  };
  const v = (n: number) => valoresF110.get(n) ?? 0;
  const hoy = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fmtHora = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  });

  const head = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Papel de trabajo · ${escape(empresa.razon_social)} · AG ${declaracion.ano_gravable}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page Section1 { size: 21.59cm 27.94cm; mso-page-orientation: portrait;
                    margin: 2cm 2.5cm 2cm 2.5cm; mso-header-margin: 1.27cm;
                    mso-footer-margin: 1.27cm; mso-paper-source: 0; }
  div.Section1 { page: Section1; }
  body { font-family: "Calibri", sans-serif; font-size: 11pt; color: #1A2D4A; }
  h1 { font-family: "Calibri", sans-serif; font-size: 28pt; color: #0A1628; margin: 0 0 6pt 0;
       letter-spacing: -0.5pt; }
  h2 { font-family: "Calibri", sans-serif; font-size: 16pt; color: #0A1628; margin: 24pt 0 8pt 0;
       border-bottom: 2pt solid #C4952A; padding-bottom: 4pt; }
  h3 { font-family: "Calibri", sans-serif; font-size: 13pt; color: #0A1628; margin: 14pt 0 6pt 0; }
  h4 { font-family: "Calibri", sans-serif; font-size: 11pt; color: #C4952A; margin: 10pt 0 4pt 0;
       text-transform: uppercase; letter-spacing: 1pt; }
  p { line-height: 1.5; margin: 0 0 8pt 0; text-align: justify; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0 12pt 0; font-size: 10pt; }
  th { background-color: #0A1628; color: #FFFFFF; padding: 6pt 8pt; text-align: left;
       font-weight: bold; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5pt; }
  td { padding: 4pt 8pt; border-bottom: 0.5pt solid #DDDDDD; vertical-align: top; }
  td.num { text-align: right; font-family: "Consolas", monospace; }
  tr.total td { background-color: #FFF8E1; font-weight: bold; }
  tr.section td { background-color: #0A1628; color: #FFFFFF; font-weight: bold;
                   text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5pt; }
  .badge { display: inline-block; padding: 2pt 8pt; font-size: 8pt;
           background-color: #C4952A; color: #0A1628; font-weight: bold;
           text-transform: uppercase; letter-spacing: 1pt; }
  .alert-ok { color: #1B5E20; font-weight: bold; }
  .alert-warn { color: #B71C1C; font-weight: bold; }
  .gold-rule { border-top: 3pt solid #C4952A; margin: 24pt 0 12pt 0; }
  .footer-tribai { text-align: center; font-size: 8pt; color: #C4952A;
                    border-top: 0.5pt solid #C4952A; padding-top: 8pt; margin-top: 16pt; }
  .stat-grid { display: table; width: 100%; margin: 8pt 0; }
  .stat { display: table-cell; padding: 8pt 12pt; border-right: 0.5pt solid #DDDDDD;
           vertical-align: top; }
  .stat:last-child { border-right: none; }
  .stat-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 1pt; color: #888; }
  .stat-value { font-size: 18pt; font-weight: bold; color: #0A1628; }
  blockquote { border-left: 3pt solid #C4952A; padding-left: 12pt; margin: 8pt 0;
               font-style: italic; color: #555; }
</style>
</head>
<body><div class="Section1">`;

  const portada = `
<table style="border: none; margin: 0;">
  <tr>
    <td style="border: none; background: #0A1628; padding: 36pt; color: #FFFFFF; vertical-align: top;">
      <div style="font-size: 36pt; font-weight: bold; letter-spacing: -1pt;">tribai<span style="color: #C4952A;">.co</span></div>
      <div style="font-size: 11pt; color: #C4952A; margin-top: 4pt; letter-spacing: 0.5pt;">
        El Estatuto, la calculadora y el criterio. Todo en uno.
      </div>
    </td>
  </tr>
</table>

<h1 style="margin-top: 30pt;">Papel de trabajo</h1>
<h3 style="color: #C4952A; margin-top: 0;">Declaración de Renta y Complementarios · Formulario 110</h3>

<table style="border: none; margin-top: 36pt;">
  <tr>
    <td style="border: none; width: 50%; padding: 0;">
      <p style="margin: 0;"><strong>Contribuyente</strong><br>${escape(empresa.razon_social)}</p>
      <p style="margin: 6pt 0;"><strong>NIT</strong><br>${empresa.nit}${empresa.dv ? "-" + empresa.dv : ""}</p>
      <p style="margin: 6pt 0;"><strong>Régimen</strong><br>${escape(empresa.regimen_codigo ?? "01")} · Persona Jurídica</p>
    </td>
    <td style="border: none; width: 50%; padding: 0; text-align: right;">
      <p style="margin: 0;"><strong>Año gravable</strong><br>${declaracion.ano_gravable}</p>
      <p style="margin: 6pt 0;"><strong>Fecha de emisión</strong><br>${escape(hoy)}</p>
      <p style="margin: 6pt 0;"><strong>Estado declaración</strong><br>${escape(declaracion.estado)}</p>
    </td>
  </tr>
</table>

<div class="gold-rule"></div>

<p style="margin-top: 24pt; color: #555;">
  Este documento técnico-gerencial consolida los cálculos, conciliaciones,
  anexos y validaciones cruzadas de la declaración del Impuesto sobre
  la Renta y Complementarios del año gravable ${declaracion.ano_gravable}.
</p>
<p style="color: #555;">
  Las cifras provienen del balance fiscal cargado, los anexos capturados
  por el equipo contable y los cálculos automáticos del motor Tribai
  alineado con el Estatuto Tributario Nacional, la Resolución DIAN
  71/2019 (F2516) y las modificaciones de la Ley 2277/2022.
</p>

<p style="margin-top: 36pt; font-size: 9pt; color: #888;">
  Generado el ${escape(fmtHora)} · Documento de trabajo · No oficial<br>
  Para presentación oficial valide los valores en MUISCA antes de firmar.
</p>

<div style="page-break-after: always;"></div>`;

  // Resumen ejecutivo
  const r46 = v(46);
  const r79 = v(79);
  const r99 = v(99);
  const r113 = v(113);
  const r114 = v(114);
  const resumenEjec = `
<h2>1. Resumen ejecutivo</h2>
<p>
  La declaración consolida un patrimonio líquido fiscal de <strong>${$(r46)}</strong>
  y una renta líquida gravable de <strong>${$(r79)}</strong>, generando un
  impuesto a cargo de <strong>${$(r99)}</strong>. El saldo final a pagar
  asciende a <strong>${$(r113)}</strong>${r114 > 0 ? ` (saldo a favor: ${$(r114)})` : ""}.
</p>

<div class="stat-grid">
  <div class="stat">
    <div class="stat-label">Patrimonio líquido (R46)</div>
    <div class="stat-value">${$(r46)}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Renta líquida gravable (R79)</div>
    <div class="stat-value">${$(r79)}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Impuesto a cargo (R99)</div>
    <div class="stat-value">${$(r99)}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Saldo a pagar (R113)</div>
    <div class="stat-value">${$(r113)}</div>
  </div>
</div>

<h3>Estado de las validaciones</h3>
<p>
  Tribai ejecutó <strong>${rv.total}</strong> validaciones cruzadas sobre el
  Formulario 110, el F2516 y los anexos. Resultado:
  <span class="alert-${rv.errores > 0 ? "warn" : "ok"}">
    ${rv.errores} errores, ${rv.warnings} advertencias, ${rv.ok} cuadres correctos.
  </span>
</p>

<blockquote>
  <strong>Recomendación:</strong> revisar el detalle de validaciones (sección 9)
  antes de presentar la declaración. Las alertas marcadas con ⚠ deben
  resolverse o documentarse explícitamente como decisión profesional.
</blockquote>

<div style="page-break-after: always;"></div>`;

  // Datos del contribuyente
  const datosContrib = `
<h2>2. Datos del contribuyente</h2>
<table>
  <tr><th>Concepto</th><th>Valor</th></tr>
  <tr><td>Razón social</td><td>${escape(empresa.razon_social)}</td></tr>
  <tr><td>NIT</td><td>${empresa.nit}${empresa.dv ? "-" + empresa.dv : ""}</td></tr>
  <tr><td>Régimen tributario</td><td>${escape(empresa.regimen_codigo ?? "01")}</td></tr>
  <tr><td>Código CIIU</td><td>${escape(empresa.ciiu_codigo ?? "—")}</td></tr>
  <tr><td>Marco normativo contable</td><td>${escape(h1?.marco_normativo ?? "NIIF Pymes")}</td></tr>
  <tr><td>Representante legal</td><td>${escape(h1?.rep_legal_nombre ?? "—")} (${escape(h1?.rep_legal_tipo_doc ?? "CC")} ${escape(h1?.rep_legal_numero_doc ?? "—")})</td></tr>
  <tr><td>Contador público</td><td>${escape(h1?.contador_nombre ?? "—")} · T.P. ${escape(h1?.contador_tarjeta_prof ?? "—")}</td></tr>
  ${h1?.obligado_revisor_fiscal
    ? `<tr><td>Revisor Fiscal</td><td>${escape(h1.rf_nombre ?? "—")} · T.P. ${escape(h1.rf_tarjeta_prof ?? "—")}</td></tr>`
    : ""}
  <tr><td>Año gravable</td><td>${declaracion.ano_gravable}</td></tr>
  <tr><td>Fecha de vencimiento</td><td>${escape(declaracion.fecha_vencimiento ?? "—")}</td></tr>
  <tr><td>Estado</td><td>${escape(declaracion.estado)}</td></tr>
</table>`;

  // Marco normativo
  const marco = `
<h2>3. Marco normativo aplicable</h2>
<p>
  La depuración tributaria del año gravable ${declaracion.ano_gravable} se
  fundamenta en las siguientes disposiciones:
</p>
<table>
  <tr><th>Norma</th><th>Aplicación</th></tr>
  <tr><td>Estatuto Tributario · Art. 240</td><td>Tarifa general del 35% para personas jurídicas + sobretasas para sectores especiales (financiero, hidroeléctricas, extractoras)</td></tr>
  <tr><td>Art. 240 par. 6</td><td>Tasa Mínima de Tributación Depurada (15% sobre utilidad depurada)</td></tr>
  <tr><td>Art. 235-2</td><td>Rentas exentas con límite del 10% sobre RL para numerales 1-6</td></tr>
  <tr><td>Art. 147</td><td>Compensación de pérdidas fiscales con plazo de 12 años</td></tr>
  <tr><td>Art. 236-238</td><td>Conciliación patrimonial · renta por comparación patrimonial</td></tr>
  <tr><td>Art. 259</td><td>Tope del 75% para descuentos tributarios</td></tr>
  <tr><td>Art. 807</td><td>Anticipo del impuesto · método más favorable (mínimo entre dos)</td></tr>
  <tr><td>Art. 641-644</td><td>Sanciones por extemporaneidad y corrección</td></tr>
  <tr><td>Ley 2277/2022</td><td>Renta presuntiva 0% AG 2025 · Tarifa GO 15%</td></tr>
  <tr><td>Resolución DIAN 71/2019</td><td>Estructura del Formato 2516 (H1-H7)</td></tr>
  <tr><td>Decreto 2650/93</td><td>Catálogo Único de Cuentas (PUC)</td></tr>
</table>`;

  // F110 renglón por renglón
  const renglonesClave = [
    33, 34, 35,
    44, 45, 46,
    47, 48, 57, 58, 59, 60, 61,
    62, 63, 64, 65, 66, 67,
    72, 74, 75, 76, 77, 78, 79,
    80, 81, 82, 83,
    84, 85, 91, 93, 94, 95, 96, 97, 99,
    107, 108, 112, 113, 114,
  ];
  const filasF110 = renglonesClave
    .map((n) => {
      const r = d.renglones.find((x) => x.numero === n);
      if (!r) return null;
      return `<tr><td>${n}</td><td>${escape(r.descripcion)}</td><td>${escape(r.seccion)}</td><td class="num">${$(v(n))}</td></tr>`;
    })
    .filter(Boolean)
    .join("");

  const formulario = `
<h2>4. Formulario 110 · cálculo completo</h2>
<p>
  El Formulario 110 fue computado a partir del balance fiscal con los ajustes
  capturados por el equipo, aplicando las reglas del Estatuto Tributario para
  cada sección (patrimonio, ingresos, costos y deducciones, renta, ganancias
  ocasionales y liquidación privada).
</p>
<table>
  <tr><th>Renglón</th><th>Concepto</th><th>Sección</th><th style="text-align: right;">Valor</th></tr>
  ${filasF110}
</table>
<p style="font-size: 9pt; color: #888;">
  Renglones con valor cero no se muestran para mayor claridad. Para el detalle
  completo consulte el papel de trabajo en Excel.
</p>`;

  // Conciliación de utilidad
  const concUtil = `
<h2>5. Conciliación de utilidad contable a fiscal</h2>
<p>
  Reconcilia la utilidad contable bajo NIIF con la renta líquida fiscal, aplicando
  el modelo de actualicese (NIC 12) con tres categorías: temporarias deducibles
  (ATD), temporarias imponibles (PTD) y permanentes.
</p>
<table>
  <tr><th>Concepto</th><th style="text-align: right;">Valor</th></tr>
  <tr><td>Utilidad contable antes de impuestos</td><td class="num">${$(concUtilidad.utilidadContableTotal)}</td></tr>
  <tr><td>(+) Diferencias temporarias deducibles · generan ATD</td><td class="num">${$(concUtilidad.subtotales.temporariasDeducibles)}</td></tr>
  <tr><td>(−) Diferencias temporarias imponibles · generan PTD</td><td class="num">${$(-concUtilidad.subtotales.temporariasImponibles)}</td></tr>
  <tr><td>(±) Diferencias permanentes</td><td class="num">${$(concUtilidad.subtotales.permanentes)}</td></tr>
  <tr class="total"><td>Renta líquida fiscal calculada</td><td class="num">${$(concUtilidad.rentaLiquidaCalculada)}</td></tr>
  <tr class="total"><td>RLG según F110 (R79)</td><td class="num">${$(v(79))}</td></tr>
</table>
<p>
  <strong>Estado:</strong>
  <span class="alert-${concUtilidad.estado === "cuadrado" ? "ok" : "warn"}">
    ${concUtilidad.estado === "cuadrado" ? "✓ Conciliación cuadrada" : concUtilidad.estado === "descuadrado_leve" ? "⚠ Descuadre leve" : "⨯ Descuadre material"}
  </span>
</p>

<h4>Partidas conciliatorias (auto + manuales)</h4>
<table>
  <tr><th>Concepto</th><th>Categoría</th><th>Origen</th><th style="text-align: right;">Valor</th></tr>
  ${concUtilidad.partidas.map((p) => `<tr><td>${escape(p.concepto)}</td><td>${categoriaLabel(p.categoria)}</td><td>${p.origen}</td><td class="num">${p.signo === "menos" ? "−" : ""}${$(p.valor)}</td></tr>`).join("")}
</table>`;

  // Conciliación patrimonial
  const concPatr = `
<h2>6. Conciliación patrimonial · Art. 236 E.T.</h2>
<p>
  Conforme al modelo Aries (actualicese.com), justifica la variación del
  patrimonio líquido fiscal entre el año anterior y el actual. El crecimiento
  no justificado se convierte en renta presunta por comparación patrimonial
  (suma a R78).
</p>
<table>
  <tr><th>Concepto</th><th style="text-align: right;">Valor</th></tr>
  <tr><td>PL fiscal año anterior</td><td class="num">${$(concPatrimonial.plAnterior)}</td></tr>
  <tr><td>PL fiscal año actual (R46)</td><td class="num">${$(concPatrimonial.plActual)}</td></tr>
  <tr><td>Variación patrimonial bruta</td><td class="num">${$(concPatrimonial.variacionBruta)}</td></tr>
  ${concPatrimonial.justificantes.map((j) => `<tr><td>(+) ${escape(j.label)}</td><td class="num">${$(j.valor)}</td></tr>`).join("")}
  ${concPatrimonial.restadores.map((j) => `<tr><td>(−) ${escape(j.label)}</td><td class="num">${$(-j.valor)}</td></tr>`).join("")}
  <tr class="total"><td>PL justificado</td><td class="num">${$(concPatrimonial.plJustificado)}</td></tr>
  <tr><td>Diferencia por justificar</td><td class="num">${$(concPatrimonial.diferenciaPorJustificar)}</td></tr>
  <tr class="total"><td>Renta por comparación patrimonial (Art. 236)</td><td class="num">${$(concPatrimonial.rentaPorComparacion)}</td></tr>
</table>
<p>
  <strong>Estado:</strong>
  <span class="alert-${concPatrimonial.cuadra ? "ok" : "warn"}">
    ${concPatrimonial.estado === "no_aplica" ? "No aplica (primer año declarando)" : concPatrimonial.cuadra ? "✓ Cuadrado" : "⚠ Renta presunta a adicionar"}
  </span>
</p>`;

  // F2516 H7 Resumen
  const f2516Resumen = `
<h2>7. Formato 2516 · Resumen consolidado</h2>
<p>
  Conciliación contable-fiscal oficial bajo la Resolución DIAN 71/2019.
  Estructura H1-H7: carátula, Estado de Situación Financiera (ESF), Estado
  de Resultados Integral (ERI), Impuesto Diferido (NIC 12), Ingresos y
  Facturación, Activos Fijos y Resumen consolidado.
</p>

<h3>ESF · Patrimonio</h3>
<table>
  <tr><th>Concepto</th><th style="text-align: right;">Valor fiscal</th></tr>
  <tr><td>Total activos</td><td class="num">${$(h7.totalActivos)}</td></tr>
  <tr><td>Total pasivos</td><td class="num">${$(h7.totalPasivos)}</td></tr>
  <tr class="total"><td>Patrimonio líquido</td><td class="num">${$(h7.patrimonioLiquido)}</td></tr>
</table>

<h3>ERI · Resultado del ejercicio</h3>
<table>
  <tr><th>Concepto</th><th style="text-align: right;">Valor fiscal</th></tr>
  <tr><td>Total ingresos</td><td class="num">${$(h7.totalIngresos)}</td></tr>
  <tr><td>Total costos y gastos</td><td class="num">${$(h7.totalCostos)}</td></tr>
  <tr><td>Utilidad antes de impuestos</td><td class="num">${$(h7.utilidadAntesImpuestos)}</td></tr>
  <tr><td>Impuesto de renta</td><td class="num">${$(h7.impuestoRenta)}</td></tr>
  <tr class="total"><td>Resultado del ejercicio</td><td class="num">${$(h7.resultadoEjercicio)}</td></tr>
</table>

<h3>Impuesto Diferido NIC 12</h3>
<table>
  <tr><th>Concepto</th><th style="text-align: right;">Valor</th></tr>
  <tr><td>Total Activo por Impuesto Diferido (ATD)</td><td class="num">${$(h7.totalATD)}</td></tr>
  <tr><td>Total Pasivo por Impuesto Diferido (PTD)</td><td class="num">${$(h7.totalPTD)}</td></tr>
  <tr class="total"><td>Impuesto Diferido Neto</td><td class="num">${$(h7.impuestoDiferidoNeto)}</td></tr>
</table>

<h3>Validaciones cruzadas F2516 vs F110</h3>
<table>
  <tr><th>#</th><th>Validación</th><th style="text-align: right;">F2516</th><th style="text-align: right;">F110</th><th>Estado</th></tr>
  ${h7.cruces.map((c) => `<tr><td>${c.id}</td><td>${escape(c.desc)}</td><td class="num">${$(c.fuente2516)}</td><td class="num">${$(c.fuenteF110)}</td><td class="alert-${c.ok ? "ok" : "warn"}">${c.ok ? "✓ OK" : "⚠ Revisar"}</td></tr>`).join("")}
</table>`;

  // Anexos
  const anexos = `
<h2>8. Anexos consolidados</h2>
<table>
  <tr><th>Anexo</th><th>Renglones F110</th><th style="text-align: right;">Valor total</th></tr>
  <tr><td>Dividendos (R49-R56)</td><td>R49-R56</td><td class="num">${$(Object.values(anexosCtx.dividendos ?? {}).reduce((s, n) => s + Number(n || 0), 0))}</td></tr>
  <tr><td>Rentas exentas (Art. 235-2)</td><td>R77</td><td class="num">${$(anexosCtx.totalRentasExentas + anexosCtx.totalRentasExentasConTope)}</td></tr>
  <tr><td>Compensaciones</td><td>R74</td><td class="num">${$(anexosCtx.totalCompensaciones)}</td></tr>
  <tr><td>Recuperación deducciones</td><td>R70</td><td class="num">${$(anexosCtx.totalRecuperaciones)}</td></tr>
  <tr><td>INCRNGO</td><td>R60</td><td class="num">${$(anexosCtx.totalIncrngo)}</td></tr>
  <tr><td>Ganancia ocasional</td><td>R80-R82</td><td class="num">${$(anexosCtx.goIngresos)}</td></tr>
  <tr><td>Inversiones ESAL efectuadas</td><td>R68</td><td class="num">${$(anexosCtx.totalInversionesEsalEfectuadas)}</td></tr>
  <tr><td>Inversiones ESAL liquidadas</td><td>R69</td><td class="num">${$(anexosCtx.totalInversionesEsalLiquidadas)}</td></tr>
  <tr><td>Descuentos tributarios (con tope 75%)</td><td>R93</td><td class="num">${$(anexosCtx.totalDescuentosTributarios)}</td></tr>
  <tr><td>Autorretenciones</td><td>R105</td><td class="num">${$(anexosCtx.totalAutorretenciones)}</td></tr>
  <tr><td>Retenciones</td><td>R106</td><td class="num">${$(anexosCtx.totalRetenciones)}</td></tr>
  <tr class="total"><td>Nómina (anexo seg. social informativo)</td><td>R33-R35</td><td class="num">${$(anexosCtx.totalNomina + anexosCtx.aportesSegSocial + anexosCtx.aportesParaFiscales)}</td></tr>
</table>`;

  // Validaciones
  const valTab = `
<h2>9. Validaciones cruzadas · resumen</h2>
<p>
  Tribai ejecuta automáticamente <strong>${rv.total}</strong> validaciones sobre
  la consistencia del Formulario 110, el F2516 y los anexos. Cualquier
  diferencia se reporta con tolerancia de $1.000 para evitar ruido por
  redondeos.
</p>

<div class="stat-grid">
  <div class="stat"><div class="stat-label">Total reglas</div><div class="stat-value">${rv.total}</div></div>
  <div class="stat"><div class="stat-label" style="color: #1B5E20;">✓ OK</div><div class="stat-value" style="color: #1B5E20;">${rv.ok}</div></div>
  <div class="stat"><div class="stat-label" style="color: #B71C1C;">⚠ Errores</div><div class="stat-value" style="color: #B71C1C;">${rv.errores}</div></div>
  <div class="stat"><div class="stat-label" style="color: #7C5C00;">ℹ Advertencias</div><div class="stat-value" style="color: #7C5C00;">${rv.warnings}</div></div>
</div>

${validaciones.length > 0
  ? `<h4>Hallazgos a revisar</h4>
<table>
  <tr><th>Categoría</th><th>Nivel</th><th>Renglón</th><th>Mensaje</th></tr>
  ${validaciones.map((v) => `<tr><td>${escape(v.categoria)}</td><td class="alert-${v.nivel === "error" ? "warn" : "ok"}">${v.nivel}</td><td>${v.renglon ?? "—"}</td><td>${escape(v.mensaje)}</td></tr>`).join("")}
</table>`
  : `<p class="alert-ok">✓ Todas las validaciones cuadran sin observaciones.</p>`}`;

  // Recomendaciones
  const recom = `
<h2>10. Recomendaciones del asesor</h2>
<ol>
  <li>
    <strong>Validar el archivo en MUISCA</strong> antes de firmar y presentar.
    Las cifras de este papel de trabajo corresponden al cálculo de Tribai; la
    fuente oficial es siempre el portal DIAN.
  </li>
  <li>
    <strong>Documentar las decisiones profesionales</strong> sobre las partidas
    de conciliación (especialmente las temporarias y diferencias permanentes).
    Cada partida automática puede revisarse en su anexo de origen.
  </li>
  ${concPatrimonial.rentaPorComparacion > 0
    ? `<li>
    <strong>Atender la renta presunta por comparación patrimonial</strong>
    (${$(concPatrimonial.rentaPorComparacion)}). Capturar las partidas
    justificativas faltantes en el módulo de Conciliación Patrimonial o
    sumar el valor a R78 del F110.
  </li>`
    : ""}
  <li>
    <strong>Conservar los soportes</strong> de todas las partidas conciliatorias
    y de los anexos por al menos 5 años (Art. 632 E.T.).
  </li>
  <li>
    <strong>Revisar el cumplimiento de obligaciones formales:</strong>
    información exógena (Formato 1011), reportes de medios magnéticos, y
    cualquier requerimiento adicional según el régimen del contribuyente.
  </li>
  <li>
    <strong>Validar el cálculo del anticipo</strong> (R108) si la entidad
    cambió su nivel de ingresos o régimen.
  </li>
  ${rv.errores > 0
    ? `<li class="alert-warn">
    <strong>Resolver los ${rv.errores} errores</strong> reportados por las
    validaciones antes de presentar.
  </li>`
    : ""}
</ol>`;

  // Firmas
  const firmas = `
<h2>11. Firmas y declaración profesional</h2>
<p>
  Quienes suscriben este papel de trabajo declaran que las cifras y procedimientos
  reflejan razonablemente la información tributaria del contribuyente
  ${escape(empresa.razon_social)} para el año gravable ${declaracion.ano_gravable},
  bajo las normas y técnicas tributarias colombianas vigentes.
</p>

<table style="margin-top: 36pt;">
  <tr>
    <td style="border-bottom: 0.5pt solid #0A1628; padding: 36pt 12pt 4pt 12pt; text-align: center;">
      <strong>${escape(h1?.rep_legal_nombre ?? "_____________________")}</strong><br>
      <span style="font-size: 9pt;">Representante Legal</span><br>
      <span style="font-size: 9pt;">${escape(h1?.rep_legal_tipo_doc ?? "CC")} ${escape(h1?.rep_legal_numero_doc ?? "")}</span>
    </td>
    <td style="border-bottom: 0.5pt solid #0A1628; padding: 36pt 12pt 4pt 12pt; text-align: center;">
      <strong>${escape(h1?.contador_nombre ?? "_____________________")}</strong><br>
      <span style="font-size: 9pt;">Contador Público</span><br>
      <span style="font-size: 9pt;">T.P. ${escape(h1?.contador_tarjeta_prof ?? "")}</span>
    </td>
    ${h1?.obligado_revisor_fiscal
      ? `<td style="border-bottom: 0.5pt solid #0A1628; padding: 36pt 12pt 4pt 12pt; text-align: center;">
      <strong>${escape(h1.rf_nombre ?? "_____________________")}</strong><br>
      <span style="font-size: 9pt;">Revisor Fiscal</span><br>
      <span style="font-size: 9pt;">T.P. ${escape(h1.rf_tarjeta_prof ?? "")}</span>
    </td>`
      : ""}
  </tr>
</table>

<div class="footer-tribai">
  <strong>tribai.co</strong> · El Estatuto, la calculadora y el criterio. Todo en uno.<br>
  © 2026 INPLUX SAS · NIT 901.784.448-8 · Marca Tribai<br>
  Generado el ${escape(fmtHora)} · Versión vigente al momento de la descarga
</div>`;

  return head + portada + resumenEjec + datosContrib + marco + formulario + concUtil + concPatr + f2516Resumen + anexos + valTab + recom + firmas + `</div></body></html>`;
}

function categoriaLabel(c: string): string {
  switch (c) {
    case "temporaria_deducible":
      return "Temporaria deducible (ATD)";
    case "temporaria_imponible":
      return "Temporaria imponible (PTD)";
    case "permanente":
      return "Permanente";
    default:
      return c;
  }
}

function escape(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
