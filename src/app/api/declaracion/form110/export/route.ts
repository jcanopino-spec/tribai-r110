// Excel export del Formulario 110 completo.
// Una sola hoja con todos los renglones (5..117) computados, agrupados
// por sección. Incluye encabezado con datos del contribuyente y resumen
// ejecutivo (KPIs principales) en la parte superior.
//
// Útil como entregable formal al cliente: reemplaza el .xlsm sumaria
// del Liquidador DIAN con la versión calculada por Tribai.

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { evaluarPresentacion, ultimoDigitoNit } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";

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
    .select("razon_social, nit, dv, regimen_codigo, ciiu_codigo, direccion_seccional_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) return NextResponse.json({ error: "Empresa not found" }, { status: 404 });

  // Tarifa
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

  // Renta presuntiva
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

  // Compute
  const [{ data: valores }, { data: renglones }, anexosCtx, ttdInputs] =
    await Promise.all([
      supabase.from("form110_valores").select("numero, valor").eq("declaracion_id", declId),
      supabase
        .from("form110_renglones")
        .select("numero, descripcion, seccion")
        .eq("ano_gravable", declaracion.ano_gravable)
        .order("numero"),
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

  const r = (n: number) => numerico.get(n) ?? 0;

  const razonSocial = empresa.razon_social;
  const nitEmpresa = empresa.nit
    ? `${empresa.nit}${empresa.dv ? `-${empresa.dv}` : ""}`
    : "—";

  // ============================================================
  // Hoja "Formulario 110"
  // ============================================================
  type Cell = string | number;
  const data: Cell[][] = [
    ["FORMULARIO 110 · Declaración de Renta y Complementarios"],
    [`Persona Jurídica · AG ${declaracion.ano_gravable}`],
    [],
    ["DATOS DEL CONTRIBUYENTE"],
    ["Razón social", razonSocial],
    ["NIT", nitEmpresa],
    ["Régimen", empresa.regimen_codigo ?? "—"],
    ["CIIU", empresa.ciiu_codigo ?? "—"],
    ["Dirección Seccional", empresa.direccion_seccional_codigo ?? "—"],
    ["Tarifa", tarifaRegimen != null ? `${(tarifaRegimen * 100).toFixed(0)}%` : "—"],
    [
      "Vencimiento",
      declaracion.fecha_vencimiento ?? vencimientoSugerido ?? "—",
    ],
    [
      "Estado presentación",
      evaluacion.estado.replace("_", " "),
    ],
    [],
    ["RESUMEN EJECUTIVO"],
    ["Patrimonio líquido", "R46", r(46)],
    ["Renta líquida gravable", "R79", r(79)],
    ["Impuesto a cargo", "R99", r(99)],
    [
      r(113) > 0 ? "Saldo a pagar" : "Saldo a favor",
      r(113) > 0 ? "R113" : "R114",
      r(113) > 0 ? r(113) : r(114),
    ],
    [],
    ["RENGLONES DEL 110"],
    ["#", "Descripción", "Sección", "Valor"],
  ];

  // Mapa numero → descripcion
  const descMap = new Map<number, { descripcion: string; seccion: string }>();
  for (const ren of renglones ?? []) {
    descMap.set(ren.numero, { descripcion: ren.descripcion, seccion: ren.seccion });
  }

  // Recorrer de R5 a R117 (cubre todo el 110)
  for (let n = 5; n <= 117; n++) {
    const meta = descMap.get(n);
    if (!meta) continue;
    const valor = r(n);
    data.push([n, meta.descripcion, meta.seccion, valor]);
  }

  data.push([]);
  data.push(["980. Pago total", "", "", r(113)]);
  data.push([
    "Generado",
    new Date().toLocaleString("es-CO"),
    "",
    "",
  ]);
  data.push(["Documento de trabajo · No oficial · Validar en MUISCA"]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 10 }, // # / label
    { wch: 60 }, // Descripción / valor
    { wch: 22 }, // Sección
    { wch: 18 }, // Valor
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Formulario 110");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safe = razonSocial
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30);
  const filename = `f110_${safe}_AG${declaracion.ano_gravable}_${dateStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
