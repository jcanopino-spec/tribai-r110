import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { evaluarPresentacion, ultimoDigitoNit } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";
import { loadF2516Aggregates } from "@/lib/f2516-aggregates";
import { F2516_FILAS } from "@/engine/f2516";
import { FilaRow } from "./fila-row";

export const metadata = { title: "Formato 2516" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function Formato2516Page({
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

  // UVT
  const { data: uvtRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable + 1)
    .eq("codigo", "uvt")
    .maybeSingle();
  const uvtVigente = uvtRow ? Number(uvtRow.valor) : null;

  // Vencimiento + presentación
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

  // Compute F110 (necesario para los renglones cruzados y los totales fiscales)
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

  // Cargar agregados F2516 (contable de balance + ajustes manuales + fiscal)
  const filas = await loadF2516Aggregates(supabase, declId, numerico);

  // Resumen de cuadre
  const totalDescuadres = filas.filter(
    (f) => f.diferencia !== null && Math.abs(f.diferencia) > 1000,
  ).length;

  // Agrupar por sección
  const porSeccion = new Map<string, typeof filas>();
  for (const f of filas) {
    const arr = porSeccion.get(f.fila.seccion) ?? [];
    arr.push(f);
    porSeccion.set(f.fila.seccion, arr);
  }

  return (
    <div className="max-w-6xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Conciliaciones
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Formato 2516
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Conciliación fiscal ESF + ERI · Resolución DIAN 71/2019.
            Reporte oficial obligatorio para personas jurídicas del régimen
            ordinario. Cada fila concilia el saldo contable agregado del
            balance con el valor fiscal correspondiente, aplicando ajustes
            de conversión (NIIF), menor fiscal y mayor fiscal.
          </p>
          <p className="mt-2 text-xs font-mono uppercase tracking-[0.08em] text-muted-foreground">
            FÓRMULA · FISCAL = CONTABLE + CONVERSIÓN − MENOR FISCAL + MAYOR FISCAL
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/diagnostico`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-amber-500/60 bg-amber-500/5 px-4 text-sm hover:bg-amber-500/10"
            title="Inspecciona qué cuentas del balance alimentan cada fila del F2516"
          >
            🔍 Diagnóstico
          </Link>
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/detalle`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-white hover:opacity-90"
            style={{ backgroundColor: "#1B5AAB" }}
            title="F2516 detallado · estructura completa del archivo guía"
          >
            📋 Detalle Fiscal completo →
          </Link>
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/oficial`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-foreground/40 px-4 text-sm hover:bg-muted"
            title="Vista oficial DIAN compacta (18 filas)"
          >
            📄 Vista compacta
          </Link>
          <a
            href={`/api/conciliaciones/formato-2516/export?decl=${declId}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-secondary px-5 text-sm hover:bg-muted"
            title="Descarga el F2516 en .xlsx con detalle del balance clasificado por PUC"
          >
            ⬇️ Exportar a Excel
          </a>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
              {empresa.razon_social}
            </p>
            <p className="font-mono text-xs">AG {declaracion.ano_gravable}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Stat
          label="Filas conciliadas"
          value={`${F2516_FILAS.length - totalDescuadres}/${F2516_FILAS.length}`}
        />
        <Stat
          label="Descuadres > $1.000"
          value={String(totalDescuadres)}
          alert={totalDescuadres > 0}
        />
        <Stat
          label="Total activos fiscales"
          value={FMT.format(filas.find((f) => f.fila.id === "ESF_09_TOTAL_ACT")?.fiscal ?? 0)}
        />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-foreground text-left">
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                #
              </th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Concepto
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Contable
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Conversión
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Menor Fiscal
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Mayor Fiscal
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Fiscal
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                F110
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Δ
              </th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from(porSeccion.entries()).map(([seccion, items]) => (
              <SeccionGroup
                key={seccion}
                titulo={seccion}
                items={items}
                declId={declId}
                empresaId={empresaId}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">¿Cómo se llena?</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            <span className="font-medium text-foreground">Contable</span> ·
            se carga del balance de prueba agrupado por prefijo PUC. Si el
            balance no está cargado o las cuentas no tienen prefijo válido,
            la columna queda en cero.
          </li>
          <li>
            <span className="font-medium text-foreground">Conversión</span> ·
            ajuste por convergencia NIIF (paso de COLGAAP a NIIF). Captura
            manual.
          </li>
          <li>
            <span className="font-medium text-foreground">Menor / Mayor Fiscal</span> ·
            diferencias entre el reconocimiento contable y el fiscal:
            depreciación tributaria distinta a contable, gastos no
            deducibles (mayor), provisiones no aceptadas (menor), etc.
          </li>
          <li>
            <span className="font-medium text-foreground">Fiscal</span> ·
            calculado: Contable + Conversión − Menor + Mayor.
          </li>
          <li>
            <span className="font-medium text-foreground">F110 / Δ</span> ·
            las filas con renglón equivalente del 110 se cruzan
            automáticamente. Δ marca diferencias mayores a $1.000.
          </li>
        </ol>
      </div>
    </div>
  );
}

function SeccionGroup({
  titulo,
  items,
  declId,
  empresaId,
}: {
  titulo: string;
  items: ReturnType<typeof loadF2516Aggregates> extends Promise<infer T> ? T : never;
  declId: string;
  empresaId: string;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={10}
          className="bg-foreground/[0.04] px-2 py-1 text-[10px] font-mono uppercase tracking-[0.08em] text-foreground"
        >
          {titulo}
        </td>
      </tr>
      {items.map((it) => (
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
    </>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  const cls = alert ? "border-destructive/40 bg-destructive/5" : "border-border";
  return (
    <div className={`border p-4 ${cls}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl tracking-[-0.02em] tabular-nums">
        {value}
      </p>
    </div>
  );
}
