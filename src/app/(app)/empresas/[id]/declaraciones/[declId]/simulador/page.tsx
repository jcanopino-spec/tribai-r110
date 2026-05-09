
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computarRenglones, type ComputeContext } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { evaluarPresentacion, ultimoDigitoNit } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";
import { SimuladorClient } from "./simulador-client";
import { ModuloHeader } from "@/components/modulo-header";

export const metadata = { title: "Simulador What-If" };

export default async function SimuladorPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("*")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, razon_social, nit, regimen_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

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

  const plAnt =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);

  const [{ data: valores }, anexosCtx, ttdInputs] = await Promise.all([
    supabase.from("form110_valores").select("numero, valor").eq("declaracion_id", declId),
    loadAnexosCtx(supabase, declId, declaracion),
    loadTasaMinimaInputs(supabase, declId, declaracion),
  ]);

  // Mapa numérico base · representación serializable para pasar al cliente
  const inputsBase: Record<number, number> = {};
  for (const v of valores ?? []) {
    inputsBase[v.numero] = normalizarSigno(v.numero, Number(v.valor));
  }

  // Ctx base · todos los flags de la declaración
  const ctxBase: ComputeContext = {
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
  };

  // Calcular Base ahora para mostrar valores iniciales (hint visual)
  const inputsMap = new Map<number, number>(
    Object.entries(inputsBase).map(([k, v]) => [Number(k), v]),
  );
  const numericoBase = computarRenglones(inputsMap, ctxBase);

  return (
    <div className="max-w-6xl">
      <ModuloHeader
        titulo="Simulador What-If"
        moduloLabel="Planeación · 4 escenarios"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}`}
        volverLabel="Editor"
        contexto={`${empresa.razon_social} · AG ${declaracion.ano_gravable}`}
      />
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Compara hasta tres escenarios contra la base actual de la declaración.
        Modifica las variables clave (ingresos, costos, descuentos, retenciones,
        etc.) y observa el impacto en el saldo final. Los cambios NO se guardan
        en la declaración: el simulador es solo para planeación.
      </p>

      <SimuladorClient
        inputsBase={inputsBase}
        ctxBase={ctxBase}
        renglonesBase={Object.fromEntries(numericoBase)}
      />
    </div>
  );
}
