// Excel export del Checklist Normativo.
// Una hoja con los 23 items + estado auto-evaluado + sección agrupadora.
// Útil como soporte de revisión que el contador firma antes de presentar.

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
import { validarF2516 } from "@/engine/validaciones";
import { evaluarChecklist, resumenChecklist } from "@/engine/checklist";

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
    .select("razon_social, nit, dv, ciiu_codigo, regimen_codigo")
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

  const { data: uvtRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable + 1)
    .eq("codigo", "uvt")
    .maybeSingle();
  const uvtVigente = uvtRow ? Number(uvtRow.valor) : null;

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

  const filasF2516 = await loadF2516Aggregates(supabase, declId, numerico);
  const valF2516 = validarF2516(filasF2516);
  const hayDescuadresF2516 = valF2516.some((v) => v.nivel === "error" || v.nivel === "warn");

  const checklist = evaluarChecklist({
    nit: empresa.nit,
    dv: empresa.dv,
    ciiu: empresa.ciiu_codigo,
    razonSocial: empresa.razon_social,
    regimenCodigo: empresa.regimen_codigo,
    tarifaRegimen,
    numerico,
    presentacionOportuna: evaluacion.estado === "oportuna",
    ttdAplicaPorRegimen: aplicaTTDPorRegimen(empresa.regimen_codigo).aplica,
    esVinculadoSubcap: !!declaracion.sub_es_vinculado,
    codRepresentacion: declaracion.cod_representacion ?? null,
    codContadorRF: declaracion.cod_contador_rf ?? null,
    hayDescuadresF2516,
    calculaAnticipo: !!declaracion.calcula_anticipo,
    aniosDeclarando: declaracion.anios_declarando as
      | "primero" | "segundo" | "tercero_o_mas" | undefined,
  });
  const resumen = resumenChecklist(checklist);

  const razonSocial = empresa.razon_social;
  const nitEmpresa = empresa.nit
    ? `${empresa.nit}${empresa.dv ? `-${empresa.dv}` : ""}`
    : "—";

  type Cell = string | number;
  const ESTADO_LABEL = {
    ok: "✓ OK",
    fail: "✕ FALLA",
    manual: "? Manual",
    n_a: "— N/A",
  } as const;

  const data: Cell[][] = [
    [`CHECKLIST NORMATIVO · ${razonSocial} (NIT ${nitEmpresa})`],
    [`AG ${declaracion.ano_gravable} · Generado ${new Date().toLocaleString("es-CO")}`],
    [],
    ["RESUMEN"],
    ["OK auto-verificadas", resumen.ok],
    ["FALLA (auto-detectadas)", resumen.fail],
    ["Manual (criterio profesional)", resumen.manual],
    ["No aplica", resumen.na],
    ["Total items", resumen.total],
    [
      "Cumplimiento auto",
      resumen.bloqueante ? "BLOQUEADO" : "Sin fallas auto",
    ],
    [],
    ["DETALLE"],
    [
      "Sección",
      "#",
      "Concepto",
      "Art. E.T.",
      "Tipo",
      "Estado",
      "Detalle",
      "Verificado por",
      "Fecha",
      "Observación",
    ],
  ];

  for (const c of checklist) {
    data.push([
      c.item.seccion,
      c.item.numero,
      c.item.concepto,
      c.item.artET,
      c.item.tipo,
      ESTADO_LABEL[c.estado],
      c.detalle ?? "",
      "", // Verificado por (manual)
      "", // Fecha (manual)
      "", // Observación (manual)
    ]);
  }

  data.push([]);
  data.push(["FIRMA DEL REVISOR"]);
  data.push([
    "Nombre",
    "",
    "",
    "",
    "Fecha",
    "",
    "",
    "Tarjeta profesional",
    "",
    "",
  ]);
  data.push([]);
  data.push([
    "Documento de trabajo · Tribai R110 · No oficial · La firma final es responsabilidad profesional del contador",
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 16 }, // Sección
    { wch: 4 }, // #
    { wch: 50 }, // Concepto
    { wch: 14 }, // Art ET
    { wch: 8 }, // Tipo
    { wch: 14 }, // Estado
    { wch: 50 }, // Detalle
    { wch: 22 }, // Verificado por
    { wch: 12 }, // Fecha
    { wch: 30 }, // Observación
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Checklist Normativo");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safe = razonSocial
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30);
  const filename = `checklist_${safe}_AG${declaracion.ano_gravable}_${dateStr}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
