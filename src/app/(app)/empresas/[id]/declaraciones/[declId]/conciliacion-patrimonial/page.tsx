import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { evaluarPresentacion, ultimoDigitoNit } from "@/engine/vencimientos";
import { PartidaPatrimonialForm } from "./partida-form";
import { PartidasPatrimonialList, type PartidaItem } from "./list";

export const metadata = { title: "Conciliación Patrimonial" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function ConciliacionPatrimonialPage({
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
    .select("razon_social, nit, regimen_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  // Cargar tarifa, UVT, vencimiento (igual que /formulario-110)
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
  const fechaVencimientoEfectiva =
    declaracion.fecha_vencimiento ?? vencimientoSugerido;
  const evaluacion = evaluarPresentacion(
    fechaVencimientoEfectiva,
    declaracion.fecha_presentacion,
  );

  // Cargar valores y anexos
  const [{ data: valores }, { data: retenciones }, { data: descuentos },
    { data: gos }, { data: rentasExentas }, { data: compensaciones },
    { data: recups }, { data: incrngos }, { data: divs },
    { data: dividendosDistribuir }, { data: manualPartidas },
  ] = await Promise.all([
    supabase.from("form110_valores").select("numero, valor").eq("declaracion_id", declId),
    supabase.from("anexo_retenciones").select("tipo, retenido").eq("declaracion_id", declId),
    supabase.from("anexo_descuentos").select("valor_descuento").eq("declaracion_id", declId),
    supabase.from("anexo_ganancia_ocasional").select("precio_venta, costo_fiscal, no_gravada").eq("declaracion_id", declId),
    supabase.from("anexo_rentas_exentas").select("valor_fiscal").eq("declaracion_id", declId),
    supabase.from("anexo_compensaciones").select("compensar").eq("declaracion_id", declId),
    supabase.from("anexo_recuperaciones").select("valor").eq("declaracion_id", declId),
    supabase.from("anexo_incrngo").select("valor").eq("declaracion_id", declId),
    supabase.from("anexo_dividendos").select("no_constitutivos, distribuidos_no_residentes, gravados_tarifa_general, gravados_persona_natural_dos, gravados_personas_extranjeras, gravados_art_245, gravados_tarifa_l1819, gravados_proyectos").eq("declaracion_id", declId),
    supabase.from("anexo_dividendos_distribuir").select("dividendo_no_gravado, dividendo_gravado").eq("declaracion_id", declId),
    supabase.from("conciliacion_patrimonial_partidas").select("*").eq("declaracion_id", declId).order("created_at"),
  ]);

  const totalAutorret = (retenciones ?? []).filter(r => r.tipo === "autorretencion").reduce((s, r) => s + Number(r.retenido), 0);
  const totalRet = (retenciones ?? []).filter(r => r.tipo === "retencion").reduce((s, r) => s + Number(r.retenido), 0);
  const totalDesc = (descuentos ?? []).reduce((s, d) => s + Number(d.valor_descuento), 0);
  const goIngresos = (gos ?? []).reduce((s, g) => s + Number(g.precio_venta), 0);
  const goCostos = (gos ?? []).reduce((s, g) => s + Number(g.costo_fiscal), 0);
  const goNoGravada = (gos ?? []).reduce((s, g) => s + Number(g.no_gravada), 0);
  const totalRE = (rentasExentas ?? []).reduce((s, r) => s + Number(r.valor_fiscal), 0);
  const totalComp = (compensaciones ?? []).reduce((s, c) => s + Number(c.compensar), 0);
  const totalRec = (recups ?? []).reduce((s, r) => s + Number(r.valor), 0);
  const totalIncr = (incrngos ?? []).reduce((s, i) => s + Number(i.valor), 0);
  const dividendos = {
    r49: (divs ?? []).reduce((s, d) => s + Number(d.no_constitutivos), 0),
    r50: (divs ?? []).reduce((s, d) => s + Number(d.distribuidos_no_residentes), 0),
    r51: (divs ?? []).reduce((s, d) => s + Number(d.gravados_tarifa_general), 0),
    r52: (divs ?? []).reduce((s, d) => s + Number(d.gravados_persona_natural_dos), 0),
    r53: (divs ?? []).reduce((s, d) => s + Number(d.gravados_personas_extranjeras), 0),
    r54: (divs ?? []).reduce((s, d) => s + Number(d.gravados_art_245), 0),
    r55: (divs ?? []).reduce((s, d) => s + Number(d.gravados_tarifa_l1819), 0),
    r56: (divs ?? []).reduce((s, d) => s + Number(d.gravados_proyectos), 0),
  };

  // Renta presuntiva (Anexo 1)
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

  // Compute completo
  const inputs = new Map<number, number>();
  for (const v of valores ?? []) {
    inputs.set(v.numero, normalizarSigno(v.numero, Number(v.valor)));
  }
  const numerico = computarRenglones(inputs, {
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
    calculaSancionCorreccion: !!declaracion.calcula_sancion_correccion,
    mayorValorCorreccion: Number(declaracion.mayor_valor_correccion ?? 0),
    existeEmplazamiento: !!declaracion.existe_emplazamiento,
    reduccionSancion: (declaracion.reduccion_sancion ?? "0") as "0" | "50" | "75",
    uvtVigente: uvtVigente ?? undefined,
    patrimonioLiquidoAnterior: plAnt,
    esInstitucionFinanciera: !!declaracion.es_institucion_financiera,
    totalNomina: Number(declaracion.total_nomina ?? 0),
    aportesSegSocial: Number(declaracion.aportes_seg_social ?? 0),
    aportesParaFiscales: Number(declaracion.aportes_para_fiscales ?? 0),
    totalAutorretenciones: totalAutorret,
    totalRetenciones: totalRet,
    totalDescuentosTributarios: totalDesc,
    goIngresos, goCostos, goNoGravada,
    totalRentasExentas: totalRE,
    totalCompensaciones: totalComp,
    totalRecuperaciones: totalRec,
    rentaPresuntiva,
    totalIncrngo: totalIncr,
    dividendos,
  });
  const v = (n: number) => numerico.get(n) ?? 0;

  // ========== AUTO PARTIDAS ==========
  // (+) Renta líquida del ejercicio (R75)
  // (+) Renta exenta (R77) — fiscalmente exenta, aumenta PL
  // (+) INCRNGO (R60) — no constituye renta, aumenta PL
  // (+) Ganancia ocasional gravable (R83)
  // (+) Dividendos no constitutivos recibidos (R49)
  // (−) Pérdida líquida (R73)
  // (−) Total impuesto a cargo (R99)
  // (−) Sanciones (R112)
  // (−) Anticipo año siguiente (R108)
  // (−) Dividendos a distribuir a socios (Anexo 25)
  const totalDividendosADistribuir = (dividendosDistribuir ?? []).reduce(
    (s, d) => s + Number(d.dividendo_no_gravado) + Number(d.dividendo_gravado),
    0,
  );

  const autoPartidas: PartidaItem[] = [
    {
      id: "auto-r75",
      origen: "auto", fuente: "F110 R75",
      signo: "mas",
      concepto: "Renta líquida del ejercicio (R75)",
      valor: v(75),
      observacion: "Utilidad fiscal generada en el año (después de compensaciones).",
    },
    {
      id: "auto-r77",
      origen: "auto", fuente: "F110 R77",
      signo: "mas",
      concepto: "Renta exenta (R77)",
      valor: v(77),
      observacion: "Rentas exentas que sí aumentan el patrimonio aunque no tributen.",
    },
    {
      id: "auto-r60",
      origen: "auto", fuente: "F110 R60",
      signo: "mas",
      concepto: "Ingresos no constitutivos de renta ni GO (R60)",
      valor: v(60),
      observacion: "INCRNGO: aumentan PL aunque no constituyan renta fiscal.",
    },
    {
      id: "auto-r83",
      origen: "auto", fuente: "F110 R83",
      signo: "mas",
      concepto: "Ganancias ocasionales gravables (R83)",
      valor: v(83),
      observacion: "Ganancias por activos fijos, herencias, rifas, etc.",
    },
    {
      id: "auto-r49",
      origen: "auto", fuente: "F110 R49",
      signo: "mas",
      concepto: "Dividendos no constitutivos recibidos (R49)",
      valor: v(49),
    },
    {
      id: "auto-r73",
      origen: "auto", fuente: "F110 R73",
      signo: "menos",
      concepto: "Pérdida líquida del ejercicio (R73)",
      valor: v(73),
      observacion: "Si hay pérdida fiscal, reduce el patrimonio líquido.",
    },
    {
      id: "auto-r99",
      origen: "auto", fuente: "F110 R99",
      signo: "menos",
      concepto: "Total impuesto a cargo (R99)",
      valor: v(99),
      observacion: "Impuesto causado del año, consume patrimonio.",
    },
    {
      id: "auto-r112",
      origen: "auto", fuente: "F110 R112",
      signo: "menos",
      concepto: "Sanciones (R112)",
      valor: v(112),
    },
    {
      id: "auto-r108",
      origen: "auto", fuente: "F110 R108",
      signo: "menos",
      concepto: "Anticipo renta para el año siguiente (R108)",
      valor: v(108),
      observacion: "Anticipo causado, se pagará pero ya reduce PL fiscal.",
    },
    {
      id: "auto-anexo25",
      origen: "auto", fuente: "Anexo 25",
      signo: "menos",
      concepto: "Distribución de dividendos a socios (Anexo 25)",
      valor: totalDividendosADistribuir,
      observacion: "Repartos a accionistas reducen el patrimonio.",
    },
  ].filter((p) => p.valor > 0) as PartidaItem[];

  const manuales: PartidaItem[] = (manualPartidas ?? []).map((p) => ({
    id: p.id,
    origen: "manual" as const,
    signo: p.signo as "mas" | "menos",
    concepto: p.concepto,
    valor: Number(p.valor),
    observacion: p.observacion,
  }));

  const todas = [...autoPartidas, ...manuales];
  const sumaMas = todas.filter((p) => p.signo === "mas").reduce((s, p) => s + p.valor, 0);
  const sumaMenos = todas.filter((p) => p.signo === "menos").reduce((s, p) => s + p.valor, 0);
  const plFinalEsperado = plAnt + sumaMas - sumaMenos;
  const plReal = v(46);
  const diferencia = plReal - plFinalEsperado;
  const cuadre = Math.abs(diferencia) < 1000; // tolerancia de redondeo DIAN

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver a Conciliaciones
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Conciliación Patrimonial
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Justifica la variación del <span className="font-medium">patrimonio líquido fiscal</span>
        entre el año anterior y el año actual. Las partidas se alimentan automáticamente
        del Formulario 110 y los anexos. Agrega manualmente solo aquello que no se deriva
        (capitalizaciones, valorizaciones, distribuciones extraordinarias).
      </p>

      {/* Cuadro de cuadre */}
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Stat label="PL inicial (AG anterior)" value={plAnt} muted />
        <Stat label="(+) Aumentos" value={sumaMas} success={sumaMas > 0} />
        <Stat label="(−) Disminuciones" value={-sumaMenos} alert={sumaMenos > 0} />
        <Stat label="PL final esperado" value={plFinalEsperado} emphasis />
      </section>

      <section className="mt-6 border border-border p-5">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          Cuadre vs Formulario 110 · Renglón 46
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">PL final esperado</p>
            <p className="mt-1 font-mono text-lg tabular-nums">{FMT.format(plFinalEsperado)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">PL fiscal real (R46)</p>
            <p className="mt-1 font-mono text-lg tabular-nums">{FMT.format(plReal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Diferencia</p>
            <p
              className={`mt-1 font-mono text-lg tabular-nums ${
                cuadre ? "text-success" : "text-destructive"
              }`}
            >
              {diferencia >= 0 ? "+" : ""}{FMT.format(diferencia)}
            </p>
          </div>
        </div>
        {cuadre ? (
          <div className="mt-4 border border-success/40 bg-success/5 p-3 text-sm">
            ✓ La conciliación cuadra (diferencia menor a $1.000, dentro de la tolerancia
            de redondeo DIAN).
          </div>
        ) : (
          <div className="mt-4 border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            ⚠ Hay una diferencia de{" "}
            <span className="font-mono">${FMT.format(Math.abs(diferencia))}</span> sin
            justificar. Agrega partidas manuales abajo (capitalizaciones,
            valorizaciones, otros) hasta que la diferencia sea cero o explicada.
          </div>
        )}
      </section>

      {/* Partidas */}
      <section className="mt-12">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          Partidas conciliatorias
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Las marcadas <span className="font-mono text-xs">auto</span> se calculan en
          tiempo real al modificar ingresos, costos, anexos o configuración. Las
          manuales se editan abajo.
        </p>
        <div className="mt-6">
          <PartidasPatrimonialList
            items={todas}
            declId={declId}
            empresaId={empresaId}
          />
        </div>
      </section>

      <section className="mt-12">
        <PartidaPatrimonialForm declId={declId} empresaId={empresaId} />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
  success,
  alert,
  muted,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  success?: boolean;
  alert?: boolean;
  muted?: boolean;
}) {
  const bgCls = emphasis
    ? "border-foreground bg-foreground text-background"
    : alert
      ? "border-destructive/40 bg-destructive/5"
      : success
        ? "border-success/40 bg-success/5"
        : "border-border";
  const labelCls = emphasis ? "text-background/70" : "text-muted-foreground";
  const valueCls = muted ? "text-muted-foreground" : "";

  return (
    <div className={`border p-4 ${bgCls}`}>
      <p className={`font-mono text-[10px] uppercase tracking-[0.08em] ${labelCls}`}>
        {label}
      </p>
      <p className={`mt-1 font-serif text-2xl tabular-nums ${valueCls}`}>
        {FMT.format(value)}
      </p>
    </div>
  );
}
