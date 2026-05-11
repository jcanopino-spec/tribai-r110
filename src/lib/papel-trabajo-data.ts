// Loader unificado · ensambla TODA la información de una declaración para
// los papeles de trabajo (Word y Excel). Garantiza que ambos generadores
// usen exactamente los mismos números, sin duplicar lógica.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { evaluarPresentacion, ultimoDigitoNit } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";
import { loadF2516Aggregates } from "@/lib/f2516-aggregates";
import { loadF2516H1, loadF2516H4, loadF2516H5, loadF2516H6 } from "@/lib/f2516-hojas";
import { computarH7 } from "@/engine/f2516-h7";
import { loadConcUtilidades } from "@/lib/conc-utilidades";
import { computarConcUtilidades } from "@/engine/conc-utilidades";
import { loadConcPatrimonial } from "@/lib/conc-patrimonial";
import {
  validarFormulario,
  validarF2516,
  validarCuadresF110,
  resumenValidaciones,
} from "@/engine/validaciones";
import { F2516_FILAS } from "@/engine/f2516";

export type PapelTrabajoData = Awaited<ReturnType<typeof loadPapelTrabajoData>>;

export async function loadPapelTrabajoData(
  supabase: SupabaseClient<Database>,
  declId: string,
) {
  // Declaración + empresa
  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("*")
    .eq("id", declId)
    .single();
  if (!declaracion) throw new Error("Declaración no encontrada");

  const { data: empresa } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) throw new Error("Empresa no encontrada");

  // Setup F110
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

  const [{ data: valores }, anexosCtx, ttdInputs, h1, h4, h5, h6] = await Promise.all([
    supabase.from("form110_valores").select("numero, valor").eq("declaracion_id", declId),
    loadAnexosCtx(supabase, declId, declaracion),
    loadTasaMinimaInputs(supabase, declId, declaracion),
    loadF2516H1(supabase, declId),
    loadF2516H4(supabase, declId),
    loadF2516H5(supabase, declId),
    loadF2516H6(supabase, declId),
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

  // Map para los engines
  const valoresF110 = new Map<number, number>();
  for (const [n, v] of numerico) valoresF110.set(n, Math.abs(v));

  // F2516
  const filasESF = await loadF2516Aggregates(supabase, declId, numerico);
  const h7 = computarH7({
    filasESF,
    resumenH4: h4,
    resumenH5: h5,
    resumenH6: h6,
    valoresF110,
    impuestoRenta: valoresF110.get(96) ?? 0,
  });

  // Conciliaciones
  const concUtilInput = await loadConcUtilidades(supabase, declaracion, valoresF110);
  const concUtilidad = computarConcUtilidades(concUtilInput);
  const concPatrimonial = await loadConcPatrimonial(
    supabase,
    declId,
    declaracion,
    valoresF110,
  );

  // Validaciones
  const validaciones = [
    ...validarFormulario(declaracion as unknown as Parameters<typeof validarFormulario>[0]),
    ...validarCuadresF110(numerico, {
      totalAutorretenciones: anexosCtx.totalAutorretenciones,
      totalRetenciones: anexosCtx.totalRetenciones,
      totalDescuentosTributarios: anexosCtx.totalDescuentosTributarios,
      totalRentasExentas: anexosCtx.totalRentasExentas,
      totalCompensaciones: anexosCtx.totalCompensaciones,
      impuestoAdicionarTTD: numerico.get(95),
      totalDividendosAnexo: Object.values(anexosCtx.dividendos ?? {}).reduce(
        (s, n) => s + Number(n || 0),
        0,
      ),
      rentaPorComparacionPatrimonial: concPatrimonial.rentaPorComparacion,
    }),
    ...validarF2516(filasESF),
  ];
  const resumen = resumenValidaciones(validaciones);

  // Catálogo de renglones para el detalle
  const { data: renglones } = await supabase
    .from("form110_renglones")
    .select("numero, descripcion, seccion")
    .eq("ano_gravable", 2025)
    .order("numero");

  return {
    declaracion,
    empresa,
    h1,
    numerico,
    valoresF110,
    anexosCtx,
    filasESF,
    h4,
    h5,
    h6,
    h7,
    concUtilidad,
    concPatrimonial,
    validaciones,
    resumenValidaciones: resumen,
    renglones: renglones ?? [],
    uvtVigente: uvtVigente ?? 0,
    tarifaRegimen: tarifaRegimen ?? 0.35,
    evaluacion,
  };
}
