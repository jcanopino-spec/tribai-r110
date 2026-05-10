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
import { ModuloHeader } from "@/components/modulo-header";
import { FilaRow } from "../fila-row";

export const metadata = { title: "F2516 H2 ESF" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function H2ESFPage({
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

  // Replica del setup de la página compacta para alimentar las filas.
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

  const filas = await loadF2516Aggregates(supabase, declId, numerico);
  // Filtrar a las secciones del ESF + Patrimonio
  const esf = filas.filter((f) =>
    ["ESF · Activos", "ESF · Pasivos", "Patrimonio"].includes(f.fila.seccion),
  );
  const totalActivos =
    esf.find((f) => f.fila.id === "ESF_09_TOTAL_ACT")?.fiscal ?? 0;
  const totalPasivos =
    esf.find((f) => f.fila.id === "ESF_10_PASIVOS")?.fiscal ?? 0;
  const patrimonio = totalActivos - totalPasivos;

  const descuadres = esf.filter(
    (f) => f.diferencia !== null && Math.abs(f.diferencia) > 1000,
  ).length;

  return (
    <div className="max-w-6xl">
      <ModuloHeader
        titulo="F2516 · H2 ESTADO DE SITUACIÓN FINANCIERA"
        moduloLabel="Activos · Pasivos · Patrimonio"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
        volverLabel="Formato 2516"
        contexto={`${empresa.razon_social} · AG ${declaracion.ano_gravable}`}
      />

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Stat label="Total activos" value={FMT.format(totalActivos)} />
        <Stat label="Total pasivos" value={FMT.format(totalPasivos)} />
        <Stat label="Patrimonio líquido" value={FMT.format(patrimonio)} highlight />
        <Stat label="Descuadres > $1.000" value={String(descuadres)} alert={descuadres > 0} />
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <Th>#</Th>
            <Th>Concepto</Th>
            <Th align="right">Contable</Th>
            <Th align="right">Conversión</Th>
            <Th align="right">Menor Fiscal</Th>
            <Th align="right">Mayor Fiscal</Th>
            <Th align="right">Fiscal</Th>
            <Th align="right">F110</Th>
            <Th align="right">Δ</Th>
            <Th>{""}</Th>
          </tr>
        </thead>
        <tbody>
          {esf.map((it) => (
            <FilaRow
              key={it.fila.id}
              declId={declId}
              empresaId={empresaId}
              filaId={it.fila.id}
              numero={it.fila.numero}
              label={it.fila.label}
              esTotal={!!it.fila.esTotal}
              contable={it.contable}
              conversion={it.conversion}
              menorFiscal={it.menorFiscal}
              mayorFiscal={it.mayorFiscal}
              fiscal={it.fiscal}
              observacion={it.observacion}
              r110={it.r110}
              diferencia={it.diferencia}
              cuadraConR110={it.fila.cuadraConR110}
              ayuda={it.fila.ayuda}
            />
          ))}
        </tbody>
      </table>

      <div className="mt-6 rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">¿Cómo conciliar el ESF?</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Cada renglón parte del saldo agregado del balance.</li>
          <li>
            Use <strong>Conversión</strong> para reclasificar adopciones NIIF (vida útil distinta, deterioros, etc).
          </li>
          <li>
            Use <strong>Menor / Mayor Fiscal</strong> para diferencias permanentes (provisiones no deducibles, intangibles no aceptados).
          </li>
          <li>
            El <strong>Fiscal</strong> debe cuadrar contra el F110 cuando aplique. La columna Δ marca diferencias mayores a $1.000.
          </li>
        </ul>
        <p className="mt-3">
          Para el detalle completo PUC × renglón, ver{" "}
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/detalle`}
            className="underline hover:text-foreground"
          >
            Detalle Fiscal
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
  highlight,
}: {
  label: string;
  value: string;
  alert?: boolean;
  highlight?: boolean;
}) {
  const cls = alert
    ? "border-destructive/40 bg-destructive/5"
    : highlight
      ? "border-foreground/40 bg-amber-500/5"
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

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}
