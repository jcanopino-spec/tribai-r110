// Guía de funcionamiento Tribai R110 · genera un archivo .doc (HTML
// con MIME word) que Microsoft Word abre directamente como documento
// formateado. Cubre todos los módulos de la app, glosario de renglones
// del F110, fórmulas críticas y validaciones implementadas.
//
// Generación HTML→Word es la opción más simple y portable: no requiere
// dependencias externas, se renderiza correctamente en Word/Pages/LibreOffice
// y conserva los estilos visuales de la marca Tribai.

import { NextResponse } from "next/server";
import { TRIBAI_BRAND } from "@/lib/brand";

export async function GET() {
  const html = generarGuiaHTML();

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword;charset=utf-8",
      "Content-Disposition": `attachment; filename="Guia_Tribai_R110_AG2025.doc"`,
    },
  });
}

function generarGuiaHTML(): string {
  const ink = TRIBAI_BRAND.ink;
  const gold = TRIBAI_BRAND.gold;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>Guía Tribai R110</title>
<style>
  body {
    font-family: 'Calibri', Arial, sans-serif;
    color: #222;
    line-height: 1.5;
    font-size: 11pt;
  }
  .portada {
    background-color: ${ink};
    color: white;
    padding: 60px 40px;
    text-align: center;
    page-break-after: always;
  }
  .portada h1 {
    font-size: 36pt;
    color: white;
    margin: 0;
    letter-spacing: 0.5pt;
  }
  .portada .marca {
    color: ${gold};
    font-size: 14pt;
    text-transform: uppercase;
    letter-spacing: 2pt;
    margin: 12pt 0;
  }
  .portada .subtitulo {
    font-size: 18pt;
    color: white;
    opacity: 0.85;
    margin-top: 24pt;
  }
  .portada .meta {
    color: ${gold};
    font-size: 10pt;
    margin-top: 60pt;
    text-transform: uppercase;
    letter-spacing: 1pt;
  }
  h1.modulo {
    background-color: ${ink};
    color: white;
    padding: 12pt 20pt;
    font-size: 20pt;
    margin: 24pt 0 12pt 0;
    border-bottom: 4pt solid ${gold};
  }
  h1.modulo span.label {
    color: ${gold};
    font-size: 10pt;
    font-weight: normal;
    margin-left: 16pt;
    text-transform: uppercase;
    letter-spacing: 1.5pt;
  }
  h2 {
    color: ${ink};
    font-size: 14pt;
    border-bottom: 2pt solid ${gold};
    padding-bottom: 4pt;
    margin-top: 24pt;
  }
  h3 {
    color: ${ink};
    font-size: 12pt;
    margin-top: 16pt;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 12pt 0;
  }
  table th {
    background-color: ${ink};
    color: white;
    padding: 6pt 10pt;
    text-align: left;
    font-size: 10pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
  }
  table td {
    border: 1pt solid #ccc;
    padding: 5pt 10pt;
    font-size: 10pt;
    vertical-align: top;
  }
  table tr:nth-child(even) td {
    background-color: #f6f8fb;
  }
  code, .codigo {
    font-family: 'Consolas', monospace;
    background-color: #f0f0f0;
    padding: 1pt 4pt;
    border-radius: 2pt;
    font-size: 9.5pt;
  }
  .badge {
    display: inline-block;
    padding: 2pt 8pt;
    border-radius: 10pt;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    font-weight: bold;
  }
  .badge-ok { background-color: #c8e6c9; color: #1b5e20; }
  .badge-err { background-color: #ffcdd2; color: #b71c1c; }
  .badge-info { background-color: #fff3cd; color: #7c5c00; }
  ul, ol { margin: 6pt 0 12pt 0; }
  li { margin-bottom: 4pt; }
  .tip {
    background-color: #fff8e1;
    border-left: 4pt solid ${gold};
    padding: 10pt 14pt;
    margin: 12pt 0;
    font-size: 10pt;
  }
  .footer-ink {
    background-color: ${ink};
    color: ${gold};
    padding: 8pt 16pt;
    margin-top: 40pt;
    text-align: center;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 1pt;
  }
</style>
</head>
<body>

<!-- ============================================================ -->
<!-- PORTADA                                                       -->
<!-- ============================================================ -->
<div class="portada">
  <div class="marca">tribai.co</div>
  <h1>R110</h1>
  <div class="subtitulo">Liquidador Formulario 110<br/>Personas Jurídicas · AG 2025</div>
  <div class="meta">
    Guía de Funcionamiento<br/>
    Versión 1.0 · ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
  </div>
</div>

<!-- ============================================================ -->
<!-- INTRODUCCIÓN                                                  -->
<!-- ============================================================ -->
<h1 class="modulo">Introducción <span class="label">Capítulo 1</span></h1>

<p><strong>Tribai R110</strong> es la versión web del Liquidador del Formulario 110 de la DIAN para personas jurídicas, año gravable 2025. Replica el archivo Excel original de tribai.co (38 hojas) con un motor de cálculo determinístico, validaciones cruzadas oficiales y un set completo de anexos.</p>

<h2>Estructura del flujo</h2>

<ol>
  <li><strong>Captura.</strong> Datos del contribuyente, balance de prueba, anexos (retenciones, descuentos, dividendos, ganancias ocasionales, etc.)</li>
  <li><strong>Cómputo.</strong> El motor calcula automáticamente los renglones derivados del 110 (R44 patrimonio, R58 ingresos, R67 costos, R72/R75/R79 renta, R83 GO, R84-R99 liquidación, R107 retenciones, R111-R114 saldos).</li>
  <li><strong>Conciliaciones.</strong> Tres puentes obligatorios DIAN: utilidad contable→fiscal, patrimonial entre años, Formato 2516 (Resolución 71/2019).</li>
  <li><strong>Validaciones.</strong> 42 reglas oficiales (V1-V22 del .xlsm) más cuadres internos.</li>
  <li><strong>Cierre.</strong> Checklist normativo, simulador what-if y vista oficial DIAN del Formulario 110.</li>
</ol>

<div class="tip">
  <strong>Identidad visual.</strong> Los headers azul oscuro (${ink}) y dorado (${gold}) replican los del archivo guía .xlsm para mantener consistencia entre la versión Excel y la versión web.
</div>

<!-- ============================================================ -->
<!-- MÓDULOS                                                       -->
<!-- ============================================================ -->
<h1 class="modulo">Módulos de la App <span class="label">Capítulo 2</span></h1>

<table>
<thead>
<tr><th>Módulo</th><th>Ruta</th><th>Función</th></tr>
</thead>
<tbody>
<tr><td><strong>Dashboard</strong></td><td>/dashboard</td><td>Vista consolidada · KPIs (R46, R79, R99, R113), progreso 10 etapas, alertas, calendario de vencimientos.</td></tr>
<tr><td><strong>Configuración</strong></td><td>/configuracion</td><td>Datos del contribuyente · 6 pestañas: General, Beneficio Auditoría, Año Anterior, Sanciones, Presentación, Otros.</td></tr>
<tr><td><strong>Balance de Prueba</strong></td><td>/balance</td><td>Carga del balance contable · clasificación PUC · ajustes débito/crédito.</td></tr>
<tr><td><strong>Anexos</strong></td><td>/anexos</td><td>22 anexos detallados · cada uno alimenta uno o más renglones del 110.</td></tr>
<tr><td><strong>Conciliaciones</strong></td><td>/conciliaciones</td><td>Conciliación de utilidad · Conciliación patrimonial · Formato 2516 · Impuesto Diferido (NIC 12).</td></tr>
<tr><td><strong>Formulario 110</strong></td><td>/formulario-110</td><td>Vista oficial DIAN con colores azul institucional · listo para imprimir.</td></tr>
<tr><td><strong>Validaciones</strong></td><td>/validaciones</td><td>42 reglas (V1-V22 oficiales del .xlsm) · errores bloquean cierre.</td></tr>
<tr><td><strong>Checklist Normativo</strong></td><td>/checklist</td><td>23 items de cumplimiento pre-presentación · 7 secciones · auto/manual.</td></tr>
<tr><td><strong>Simulador What-If</strong></td><td>/simulador</td><td>4 escenarios comparativos · 10 variables · usa el motor real.</td></tr>
</tbody>
</table>

<!-- ============================================================ -->
<!-- ANEXOS                                                        -->
<!-- ============================================================ -->
<h1 class="modulo">Anexos · Captura Detallada <span class="label">Capítulo 3</span></h1>

<table>
<thead>
<tr><th>Anexo</th><th>Renglón F110</th><th>Descripción</th></tr>
</thead>
<tbody>
<tr><td>Renta Presuntiva</td><td>R76</td><td>Patrimonio líquido AG anterior × tarifa (0% en AG 2025).</td></tr>
<tr><td>Retenciones / Autorretenciones</td><td>R105 + R106 → R107</td><td>Lista detallada por concepto, agente, NIT, base, retenido.</td></tr>
<tr><td>Descuentos Tributarios</td><td>R93</td><td>Impuestos exterior, donaciones, ICA 50%, otros · tope 75% R84 (Art. 259).</td></tr>
<tr><td>Ganancias Ocasionales</td><td>R80, R81, R82 → R83</td><td>Rifas, herencias, liquidaciones, otros conceptos GO.</td></tr>
<tr><td>Venta de Activos Fijos</td><td>R80, R81 (posesión &gt; 2 años)</td><td>Detalle de ventas; los de posesión ≤ 2 años son informativos.</td></tr>
<tr><td>Recuperación de Deducciones</td><td>R70</td><td>Reversiones de partidas que disminuyeron rentas anteriores.</td></tr>
<tr><td>Ingresos por Dividendos</td><td>R49 a R56</td><td>Dividendos por categoría tributaria y tercero · Art. 48-49 E.T.</td></tr>
<tr><td>INCRNGO</td><td>R60</td><td>Ingresos no constitutivos de renta · Arts. 36-57.</td></tr>
<tr><td>Compensaciones</td><td>R74</td><td>Pérdidas fiscales acumuladas · limitada a R72.</td></tr>
<tr><td>Rentas Exentas</td><td>R77</td><td>Total Anexo 19 · Art. 235-2 y otros.</td></tr>
<tr><td>Inversiones ESAL</td><td>R68 (efectuadas), R69 (liquidadas)</td><td>Régimen Tributario Especial · Art. 357-358 E.T.</td></tr>
<tr><td>IVA Bienes Capital</td><td>R93</td><td>IVA pagado en bienes de capital · Art. 258-1 (suma a descuentos).</td></tr>
<tr><td>Intereses Presuntivos</td><td>conciliación fiscal</td><td>Art. 35 E.T. · cálculo automático contra DTF.</td></tr>
<tr><td>Diferencia en Cambio</td><td>conciliación fiscal</td><td>TRM final · ajuste por activos/pasivos en USD.</td></tr>
<tr><td>Deterioro Cartera</td><td>conciliación fiscal</td><td>Provisión fiscal vs contable.</td></tr>
<tr><td>ICA</td><td>R93 (50%) o R63-R66</td><td>Industria y Comercio · 100% gasto OR 50% descuento (Art. 115).</td></tr>
<tr><td>GMF (4×1000)</td><td>conciliación fiscal</td><td>50% deducible (Art. 115).</td></tr>
<tr><td>Predial</td><td>R63-R66</td><td>Impuesto predial · deducible si causalidad.</td></tr>
<tr><td>Subcapitalización</td><td>conciliación fiscal</td><td>Art. 118-1 · intereses no deducibles si deuda &gt; 2× patrimonio.</td></tr>
<tr><td>Seguridad Social</td><td>R33, R34, R35</td><td>Aportes salud, pensión, ARL, parafiscales · Art. 108.</td></tr>
<tr><td>Dividendos a Distribuir</td><td>informativo</td><td>Art. 49 · gravado vs no gravado.</td></tr>
<tr><td>Beneficios Tributarios</td><td>catálogo</td><td>Economía Naranja, ZESE, ZOMAC, Hoteles, Editoriales, Zona Franca.</td></tr>
<tr><td>Precios de Transferencia</td><td>evaluación auto</td><td>Arts. 260-1 a 260-11 · umbrales 100k UVT patrimonio / 61k UVT ingresos.</td></tr>
</tbody>
</table>

<!-- ============================================================ -->
<!-- FÓRMULAS CRÍTICAS                                             -->
<!-- ============================================================ -->
<h1 class="modulo">Fórmulas Críticas del F110 <span class="label">Capítulo 4</span></h1>

<table>
<thead>
<tr><th>Renglón</th><th>Concepto</th><th>Fórmula oficial</th></tr>
</thead>
<tbody>
<tr><td>R44</td><td>Patrimonio bruto</td><td><code>sum(R36..R43)</code></td></tr>
<tr><td>R46</td><td>Patrimonio líquido</td><td><code>max(0, R44 − R45)</code></td></tr>
<tr><td>R58</td><td>Ingresos brutos</td><td><code>sum(R47..R57)</code></td></tr>
<tr><td>R61</td><td>Ingresos netos</td><td><code>max(0, R58 − R59 − R60)</code></td></tr>
<tr><td>R67</td><td>Total costos</td><td><code>sum(R62..R66)</code></td></tr>
<tr><td>R72</td><td>Renta líquida ordinaria</td><td><code>max(0, R61+R69+R70+R71 − Σ R52..R56 − R67 − R68)</code></td></tr>
<tr><td>R75</td><td>Renta líquida</td><td><code>max(0, R72 − R74)</code></td></tr>
<tr><td>R79</td><td>Renta líquida gravable</td><td><code>max(R75, R76) − R77 + R78</code></td></tr>
<tr><td>R83</td><td>GO gravables</td><td><code>max(0, R80 − R81 − R82)</code></td></tr>
<tr><td>R84</td><td>Impuesto renta</td><td><code>R79 × tarifa del régimen</code></td></tr>
<tr><td>R85</td><td>Sobretasa instituciones financieras</td><td><code>(R79 − 120.000 × UVT) × 5%</code> si financiera y supera</td></tr>
<tr><td>R86</td><td>Imp. dividendos 10%/20%</td><td><code>(R51 + R55) × 20%</code></td></tr>
<tr><td>R88</td><td>Imp. dividendos megainversiones</td><td><code>R56 × 27%</code></td></tr>
<tr><td>R89</td><td>Imp. dividendos no residentes Art. 240</td><td><code>R53 × 35%</code></td></tr>
<tr><td>R90</td><td>Imp. dividendos Art. 245</td><td><code>R52 × 33%</code></td></tr>
<tr><td>R91</td><td>Total impuesto rentas</td><td><code>sum(R84..R90)</code></td></tr>
<tr><td>R93</td><td>Descuentos tributarios</td><td><code>min(anexo, 75% × R84)</code> · Art. 259 E.T.</td></tr>
<tr><td>R94</td><td>Imp. neto sin TTD</td><td><code>max(0, R91 + R92 − R93)</code></td></tr>
<tr><td>R95</td><td>Imp. a adicionar (TTD)</td><td><code>max(0, UD × 15% − ID)</code> si TTD &lt; 15% · Art. 240 par. 6°</td></tr>
<tr><td>R96</td><td>Imp. neto con TTD</td><td><code>R94 + R95</code></td></tr>
<tr><td>R97</td><td>Imp. neto GO</td><td><code>R83 × 15%</code></td></tr>
<tr><td>R99</td><td>Total imp. a cargo</td><td><code>max(0, R96 + R97 − R98)</code></td></tr>
<tr><td>R107</td><td>Total retenciones</td><td><code>R105 + R106</code></td></tr>
<tr><td>R108</td><td>Anticipo año siguiente</td><td><code>min(método 1, método 2)</code> · Art. 807</td></tr>
<tr><td>R111</td><td>Saldo a pagar imp.</td><td><code>max(0, R99+R108+R110 − R100..R104 − R107 − R109)</code></td></tr>
<tr><td>R112</td><td>Sanciones</td><td>extemp. Art. 641/642 + corrección Art. 644 + reducción Art. 640</td></tr>
<tr><td>R113</td><td>Total saldo a pagar</td><td><code>max(0, R111 + R112)</code></td></tr>
<tr><td>R114</td><td>Total saldo a favor</td><td><code>max(0, restas − (R99+R108+R110+R112))</code></td></tr>
</tbody>
</table>

<!-- ============================================================ -->
<!-- VALIDACIONES                                                  -->
<!-- ============================================================ -->
<h1 class="modulo">Validaciones Cruzadas <span class="label">Capítulo 5</span></h1>

<p>El sistema implementa <strong>42 validaciones</strong> distribuidas en cuatro bloques:</p>

<h2>Bloque A · Cuadres internos del F110 (V7-V18 del .xlsm)</h2>

<table>
<thead><tr><th>#</th><th>Validación</th><th>Nivel</th></tr></thead>
<tbody>
<tr><td>V7</td><td>R46 = R44 − R45</td><td><span class="badge badge-err">error</span></td></tr>
<tr><td>V8</td><td>R61 = R58 − R59 − R60</td><td><span class="badge badge-err">error</span></td></tr>
<tr><td>V9</td><td>R67 = sum(R62..R66)</td><td><span class="badge badge-err">error</span></td></tr>
<tr><td>V10</td><td>R107 = R105 + R106</td><td><span class="badge badge-err">error</span></td></tr>
<tr><td>V11</td><td>R94 = max(0, R91+R92-R93)</td><td><span class="badge badge-err">error</span></td></tr>
<tr><td>V12</td><td>R79 = max(R75,R76) - R77 + R78</td><td><span class="badge badge-err">error</span></td></tr>
<tr><td>V14</td><td>R93 ≤ 75% R84 (Art. 259)</td><td><span class="badge badge-err">error fiscal</span></td></tr>
<tr><td>V16</td><td>R74 ≤ pérdidas acumuladas</td><td><span class="badge badge-err">error fiscal</span></td></tr>
<tr><td>V18</td><td>R58 ≥ Σ dividendos R49..R56</td><td><span class="badge badge-info">warn</span></td></tr>
</tbody>
</table>

<h2>Bloque B · Cruces F110 ↔ Anexos (V1-V6)</h2>

<ul>
  <li><strong>V1</strong> · R77 Anexo 19 (rentas exentas) cuadra con declarado</li>
  <li><strong>V2</strong> · R107 anexo retenciones = R105 + R106 declarado</li>
  <li><strong>V13</strong> · TTD aplicada correctamente cuando UD &gt; 0 y TTD &lt; 15%</li>
  <li><strong>V17</strong> · Dividendos gravados Ley 2277 alimentan R51..R56 correctamente</li>
</ul>

<h2>Bloque C · Cuadre Balance vs F110 (V19-V22)</h2>

<ul>
  <li><strong>V19</strong> · BP cuadrado: SI + Movimientos = SF (tolerancia $1.000)</li>
  <li><strong>V20</strong> · R58 = Σ(saldos clase 4) del balance</li>
  <li><strong>V21</strong> · R67 = Σ(saldos clases 5+6+7) del balance</li>
  <li><strong>V22</strong> · R44 = Σ(saldos clase 1) del balance</li>
</ul>

<h2>Bloque D · Otros cierres</h2>

<ul>
  <li>R91 = sum(R84..R90)</li>
  <li>R96 = R94 + R95</li>
  <li>R99 = max(0, R96 + R97 − R98)</li>
</ul>

<div class="tip">
  <strong>Tolerancia DIAN.</strong> Diferencias menores a $1.000 no se reportan (ruido de redondeo, ya que el Liquidador oficial trabaja en múltiplos de mil).
</div>

<!-- ============================================================ -->
<!-- CONDICIONALES                                                 -->
<!-- ============================================================ -->
<h1 class="modulo">Condicionales por Régimen <span class="label">Capítulo 6</span></h1>

<p>El sistema deriva automáticamente reglas de tributación según el régimen tributario de la empresa:</p>

<table>
<thead><tr><th>Código</th><th>Régimen</th><th>Tarifa</th><th>TTD</th><th>Sobretasa</th></tr></thead>
<tbody>
<tr><td>01</td><td>General PJ</td><td>35%</td><td>✓ aplica</td><td>✓ elegible</td></tr>
<tr><td>02</td><td>Cooperativas</td><td>20%</td><td>✓ aplica</td><td>—</td></tr>
<tr><td>03</td><td>ZESE</td><td>0%</td><td>✗ exonerado</td><td>—</td></tr>
<tr><td>04</td><td>ZF Comercial</td><td>35%</td><td>✗ exonerado</td><td>✓ elegible</td></tr>
<tr><td>05</td><td>ZF No Comercial</td><td>20%</td><td>✗ exonerado</td><td>—</td></tr>
<tr><td>06</td><td>ZF Cúcuta</td><td>15%</td><td>✗ exonerado</td><td>—</td></tr>
<tr><td>07</td><td>PN no residente</td><td>35%</td><td>✗ exonerado</td><td>—</td></tr>
<tr><td>08</td><td>ESAL</td><td>20%</td><td>✗ exonerado</td><td>—</td></tr>
<tr><td>09</td><td>Numerales 207-2</td><td>9%</td><td>✓ aplica</td><td>—</td></tr>
<tr><td>11</td><td>Editoriales</td><td>9%</td><td>✓ aplica</td><td>—</td></tr>
</tbody>
</table>

<!-- ============================================================ -->
<!-- DESCARGAS                                                     -->
<!-- ============================================================ -->
<h1 class="modulo">Descargas Excel <span class="label">Capítulo 7</span></h1>

<p>El sistema genera 6 entregables en formato Excel, accesibles desde el bloque "Descargas" del Dashboard:</p>

<ul>
  <li><strong>Formulario 110 completo</strong> · todos los renglones + datos del contribuyente + KPIs.</li>
  <li><strong>Formato 2516</strong> · 2 hojas (Conciliación 18 filas + Detalle PUC clasificado).</li>
  <li><strong>Impuesto Diferido</strong> · 16 categorías (9 activos + 7 pasivos) + resumen ID-A/ID-P.</li>
  <li><strong>Retenciones</strong> · 2 hojas (Detalle + Resumen por concepto).</li>
  <li><strong>Seguridad Social</strong> · empleados con aportes detallados.</li>
  <li><strong>Checklist Normativo</strong> · 23 items con espacio para firma del revisor.</li>
</ul>

<!-- ============================================================ -->
<!-- FOOTER                                                        -->
<!-- ============================================================ -->
<div class="footer-ink">
  © 2026 INPLUX SAS · NIT 901.784.448-8 · Marca Tribai · tribai.co<br/>
  Documento de trabajo · No oficial · Validar valores en MUISCA antes de presentar
</div>

</body>
</html>`;
}
