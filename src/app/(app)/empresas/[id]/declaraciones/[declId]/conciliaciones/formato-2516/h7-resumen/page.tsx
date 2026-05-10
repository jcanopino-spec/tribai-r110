import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { evaluarPresentacion, ultimoDigitoNit } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";
import { loadF2516Aggregates } from "@/lib/f2516-aggregates";
import { loadF2516H4, loadF2516H5, loadF2516H6 } from "@/lib/f2516-hojas";
import { computarH7 } from "@/engine/f2516-h7";
import { ModuloHeader } from "@/components/modulo-header";

export const metadata = { title: "F2516 H7 Resumen" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function H7Page({
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

  // Setup compute (idéntico al patrón de H2)
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
  const [{ data: valores }, anexosCtx, ttdInputs, h4, h5, h6] = await Promise.all([
    supabase.from("form110_valores").select("numero, valor").eq("declaracion_id", declId),
    loadAnexosCtx(supabase, declId, declaracion),
    loadTasaMinimaInputs(supabase, declId, declaracion),
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
  const filasESF = await loadF2516Aggregates(supabase, declId, numerico);

  const valoresF110Map = new Map<number, number>();
  for (const v of valores ?? []) {
    valoresF110Map.set(v.numero, Math.abs(Number(v.valor)));
  }

  const resumen = computarH7({
    filasESF,
    resumenH4: h4,
    resumenH5: h5,
    resumenH6: h6,
    valoresF110: valoresF110Map,
    impuestoRenta: numerico.get(96) ?? 0,
  });

  const okCount = resumen.cruces.filter((c) => c.ok).length;
  const failCount = resumen.cruces.length - okCount;

  return (
    <div className="max-w-6xl">
      <ModuloHeader
        titulo="F2516 · H7 RESUMEN ESF / ERI"
        moduloLabel="Validaciones cruzadas · vista consolidada"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
        volverLabel="Formato 2516"
        contexto={`${empresa.razon_social} · AG ${declaracion.ano_gravable}`}
      />

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Stat label="Validaciones OK" value={`${okCount}/${resumen.cruces.length}`} good={failCount === 0} />
        <Stat label="Descuadres" value={String(failCount)} alert={failCount > 0} />
        <Stat label="Imp. Diferido Neto" value={FMT.format(resumen.impuestoDiferidoNeto)} />
      </div>

      <Section title="Estado de Situación Financiera">
        <Tabla rows={[
          ["Total activos fiscales", resumen.totalActivos],
          ["Total pasivos fiscales", resumen.totalPasivos],
          ["Patrimonio líquido", resumen.patrimonioLiquido],
        ]} />
      </Section>

      <Section title="Estado de Resultados Integral">
        <Tabla rows={[
          ["Total ingresos fiscales", resumen.totalIngresos],
          ["Total costos fiscales", resumen.totalCostos],
          ["Total gastos fiscales", resumen.totalGastos],
          ["Utilidad antes de impuestos", resumen.utilidadAntesImpuestos],
          ["Impuesto de renta (R96)", resumen.impuestoRenta],
          ["Resultado del ejercicio", resumen.resultadoEjercicio],
        ]} />
      </Section>

      <Section title="Activos Fijos (H6) e Ingresos (H5)">
        <Tabla rows={[
          ["Activos fijos contables (H6)", resumen.activosFijosContables],
          ["Activos fijos fiscales (H6)", resumen.activosFijosFiscales],
          ["Ingresos H5 brutos netos", resumen.ingresosH5],
        ]} />
      </Section>

      <Section title="Impuesto Diferido (H4)">
        <Tabla rows={[
          ["Total ATD (activos por imp. diferido)", resumen.totalATD],
          ["Total PTD (pasivos por imp. diferido)", resumen.totalPTD],
          ["Imp. Diferido Neto", resumen.impuestoDiferidoNeto],
        ]} />
      </Section>

      <Section title="Validaciones cruzadas vs Formulario 110">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-foreground text-left">
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">#</th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">Validación</th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">F2516</th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">F110</th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">Δ</th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">Estado</th>
            </tr>
          </thead>
          <tbody>
            {resumen.cruces.map((c) => (
              <tr key={c.id} className="border-b border-border/50">
                <td className="px-2 py-1 font-mono text-xs text-muted-foreground">{c.id}</td>
                <td className="px-2 py-1">{c.desc}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">{FMT.format(c.fuente2516)}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">{FMT.format(c.fuenteF110)}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">{FMT.format(c.diferencia)}</td>
                <td className="px-2 py-1">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                      c.ok
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {c.ok ? "✓ OK" : "⚠ Revisar"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="mt-6 rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p>
          Esta hoja agrega los totales del{" "}
          <Link href="h2-esf" className="underline hover:text-foreground">H2 ESF</Link>,{" "}
          <Link href="h3-eri" className="underline hover:text-foreground">H3 ERI</Link>,{" "}
          <Link href="h4-impuesto-diferido" className="underline hover:text-foreground">H4 Imp Diferido</Link>,{" "}
          <Link href="h5-ingresos-facturacion" className="underline hover:text-foreground">H5 Ingresos</Link> y{" "}
          <Link href="h6-activos-fijos" className="underline hover:text-foreground">H6 Activos Fijos</Link>{" "}
          y los cruza contra el Formulario 110. Las validaciones tienen tolerancia de $1.000.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-md border border-border p-5">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Tabla({ rows }: { rows: [string, number][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-border/50">
            <td className="py-2">{k}</td>
            <td className="py-2 text-right font-mono tabular-nums font-semibold">{FMT.format(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Stat({
  label,
  value,
  alert,
  good,
}: {
  label: string;
  value: string;
  alert?: boolean;
  good?: boolean;
}) {
  const cls = alert
    ? "border-destructive/40 bg-destructive/5"
    : good
      ? "border-emerald-500/40 bg-emerald-500/5"
      : "border-border";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-xl tabular-nums">{value}</p>
    </div>
  );
}
