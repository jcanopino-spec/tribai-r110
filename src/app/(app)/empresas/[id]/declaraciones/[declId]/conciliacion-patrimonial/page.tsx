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
    { data: manualPartidas },
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

  // ========== ART. 236 COMPARACIÓN PATRIMONIAL ==========
  // El usuario agrega partidas MANUALES con conceptos especiales:
  //   - "Valorizaciones" (signo menos) · restan a la diferencia patrimonial
  //   - "Desvalorizaciones" (signo más) · suman a la diferencia
  //   - "Normalización tributaria" (signo más) · suma a las rentas ajustadas
  //   - Otras partidas explicativas
  const manuales = manualPartidas ?? [];
  const valorizaciones = manuales
    .filter((p) => p.concepto.toLowerCase().includes("valorizaci") && p.signo === "menos")
    .reduce((s, p) => s + Number(p.valor), 0);
  const desvalorizaciones = manuales
    .filter((p) => p.concepto.toLowerCase().includes("desvalorizaci") && p.signo === "mas")
    .reduce((s, p) => s + Number(p.valor), 0);
  const normalizacionTributaria = manuales
    .filter((p) => p.concepto.toLowerCase().includes("normalizaci") && p.signo === "mas")
    .reduce((s, p) => s + Number(p.valor), 0);

  // Otras partidas explicativas (informativas para el cuadre)
  const otrasManuales: PartidaItem[] = manuales
    .filter((p) => {
      const lc = p.concepto.toLowerCase();
      return !lc.includes("valorizaci") && !lc.includes("normalizaci");
    })
    .map((p) => ({
      id: p.id,
      origen: "manual" as const,
      signo: p.signo as "mas" | "menos",
      concepto: p.concepto,
      valor: Number(p.valor),
      observacion: p.observacion,
    }));

  const plReal = v(46);

  // 1 · Diferencia patrimonial (Art. 236 E.T.)
  //   = max(0, PL_actual + desvalorizaciones − valorizaciones − PL_anterior)
  const diferenciaPatrimonial = Math.max(
    0,
    plReal + desvalorizaciones - valorizaciones - plAnt,
  );

  // 2 · Rentas ajustadas
  //   = R75 + R77 + R60 + R83 + normalización − saldo pagar AG anterior − R107
  const rentasAjustadas = Math.max(
    0,
    v(75) + v(77) + v(60) + v(83) + normalizacionTributaria
      - Number(declaracion.saldo_pagar_anterior ?? 0) - v(107),
  );

  // 3 · Renta por comparación patrimonial
  //   = max(0, diferencia − rentas ajustadas)
  //   Excepto si es primera vez declarando → 0 (Art. 237 E.T. no aplica)
  const esPrimeraVez = declaracion.anios_declarando === "primero";
  const rentaPorComparacion = esPrimeraVez
    ? 0
    : Math.max(0, diferenciaPatrimonial - rentasAjustadas);

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
        Verifica que el aumento del patrimonio líquido fiscal entre el año anterior
        y el actual se explique por las rentas declaradas. Si no se explica, la DIAN
        presume <span className="font-medium">renta por comparación patrimonial</span>{" "}
        (Arts. 236-239 E.T.) que se grava como renta líquida adicional.
      </p>

      {/* === COMPARACIÓN PATRIMONIAL · Art. 236 E.T. === */}
      <section className="mt-10">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          1 · Diferencia patrimonial
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Variación del patrimonio líquido entre años, ajustada por
          desvalorizaciones y valorizaciones manuales.
        </p>
        <div className="mt-4 border border-border">
          <RowSimple label="Patrimonio líquido a 31-dic AG actual (R46)" value={plReal} />
          <RowSimple
            label="Más: Desvalorizaciones"
            value={desvalorizaciones}
            origen="manual"
          />
          <RowSimple
            label="Menos: Valorizaciones"
            value={-valorizaciones}
            origen="manual"
          />
          <RowSimple
            label="Menos: Patrimonio líquido a 31-dic AG anterior"
            value={-plAnt}
          />
          <RowSimple
            label="Diferencia patrimonial"
            value={Math.max(0, diferenciaPatrimonial)}
            bold
          />
        </div>
      </section>

      {/* === CONCILIACIÓN DE RENTAS === */}
      <section className="mt-10">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          2 · Rentas ajustadas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Suma de rentas declaradas, exentas, INCRNGO y ganancias ocasionales,
          menos impuestos pagados y retenciones practicadas en el año. Se
          alimenta automáticamente del Formulario 110.
        </p>
        <div className="mt-4 border border-border">
          <RowSimple label="Renta líquida fiscal del ejercicio (R75)" value={v(75)} />
          <RowSimple label="Más: Rentas exentas (R77)" value={v(77)} />
          <RowSimple
            label="Más: Ingresos no constitutivos de renta ni GO (R60)"
            value={v(60)}
          />
          <RowSimple label="Más: Ganancia ocasional gravable (R83)" value={v(83)} />
          <RowSimple
            label="Más: Normalización tributaria del año"
            value={normalizacionTributaria}
            origen="manual"
          />
          <RowSimple
            label="Menos: Saldo a pagar AG anterior (impuestos del año anterior pagados)"
            value={-Number(declaracion.saldo_pagar_anterior ?? 0)}
          />
          <RowSimple label="Menos: Retenciones practicadas (R107)" value={-v(107)} />
          <RowSimple label="Rentas ajustadas" value={Math.max(0, rentasAjustadas)} bold />
        </div>
      </section>

      {/* === RESULTADO === */}
      <section className="mt-10">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          3 · Renta por comparación patrimonial
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat
            label="Diferencia patrimonial"
            value={Math.max(0, diferenciaPatrimonial)}
            muted
          />
          <Stat label="Rentas ajustadas" value={Math.max(0, rentasAjustadas)} muted />
          <Stat
            label="Renta por comparación"
            value={rentaPorComparacion}
            emphasis={rentaPorComparacion > 0}
            alert={rentaPorComparacion > 0}
          />
        </div>
        {rentaPorComparacion > 0 ? (
          <div className="mt-4 border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-500">
              ⚠ Hay {FMT.format(rentaPorComparacion)} de renta presumida por DIAN
            </p>
            <p className="mt-2">
              El patrimonio aumentó más de lo que las rentas declaradas justifican.
              La DIAN puede presumir esa diferencia como renta líquida adicional
              (Art. 236 E.T.). Agrega partidas manuales abajo
              (valorizaciones, normalización tributaria, capitalizaciones)
              hasta que la diferencia se explique.
            </p>
          </div>
        ) : (
          <div className="mt-4 border border-success/40 bg-success/5 p-4 text-sm">
            ✓ El aumento patrimonial está plenamente justificado por las rentas
            declaradas. No hay renta por comparación patrimonial.
          </div>
        )}
      </section>

      {/* Otras partidas manuales explicativas */}
      {otrasManuales.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
            Otras partidas explicativas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conceptos manuales adicionales registrados pero no clasificados como
            valorizaciones ni normalización tributaria.
          </p>
          <div className="mt-4">
            <PartidasPatrimonialList
              items={otrasManuales}
              declId={declId}
              empresaId={empresaId}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          Agregar partida manual
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para que la conciliación patrimonial no genere renta presumida, registra
          aquí los conceptos que la justifican: <strong>valorizaciones</strong> de
          activos, <strong>desvalorizaciones</strong>, <strong>normalización
          tributaria</strong> del año (Ley 2277/2022), capitalizaciones, etc.
        </p>
        <div className="mt-4">
          <PartidaPatrimonialForm declId={declId} empresaId={empresaId} />
        </div>
      </section>
    </div>
  );
}

function RowSimple({
  label,
  value,
  bold,
  origen,
}: {
  label: string;
  value: number;
  bold?: boolean;
  origen?: "manual" | "auto";
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border px-4 py-2.5 last:border-b-0 text-sm ${
        bold ? "bg-muted/40" : ""
      }`}
    >
      <p className={`flex items-center gap-2 ${bold ? "font-semibold" : ""}`}>
        {label}
        {origen ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
            {origen}
          </span>
        ) : null}
      </p>
      <p
        className={`font-mono tabular-nums ${bold ? "font-semibold text-base" : ""} ${
          value < 0 ? "text-destructive" : ""
        }`}
      >
        {value === 0 ? "—" : FMT.format(value)}
      </p>
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
