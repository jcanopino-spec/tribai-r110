// Anexo IVA · captura las declaraciones del Formulario 300 del año
// gravable (bimestral o cuatrimestral) con upload de PDF y/o digitación
// manual de los valores clave.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModuloHeader } from "@/components/modulo-header";
import { IvaGrid } from "./iva-grid";
import type { IvaItem, Periodicidad } from "./consts";
import { PERIODICIDADES } from "./consts";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { evaluarPresentacion, ultimoDigitoNit } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";

export const metadata = { title: "Anexo IVA" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function AnexoIvaPage({
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

  // Defensivo · si la migración 028 no se aplicó, devuelve []
  const res = await supabase
    .from("anexo_iva_declaraciones")
    .select("*")
    .eq("declaracion_id", declId)
    .order("periodicidad")
    .order("periodo");
  const tablaExiste = !res.error;
  const items: IvaItem[] = (res.data ?? []).map((r) => ({
    ...r,
    periodicidad: r.periodicidad as Periodicidad,
    ingresos_brutos: Number(r.ingresos_brutos),
    devoluciones: Number(r.devoluciones),
    ingresos_no_gravados: Number(r.ingresos_no_gravados),
    ingresos_exentos: Number(r.ingresos_exentos),
    ingresos_gravados: Number(r.ingresos_gravados),
    iva_generado: Number(r.iva_generado),
    iva_descontable: Number(r.iva_descontable),
    saldo_pagar: Number(r.saldo_pagar),
    saldo_favor: Number(r.saldo_favor),
  }));

  // Compute F110 para el cruce contra ingresos ordinarios (R47/R58)
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
  const [{ data: valoresF110 }, anexosCtx, ttdInputs] = await Promise.all([
    supabase.from("form110_valores").select("numero, valor").eq("declaracion_id", declId),
    loadAnexosCtx(supabase, declId, declaracion),
    loadTasaMinimaInputs(supabase, declId, declaracion),
  ]);
  const inputs = new Map<number, number>();
  for (const v of valoresF110 ?? []) {
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
  const r47 = numerico.get(47) ?? 0; // Ingresos brutos actividades ordinarias
  const r58 = numerico.get(58) ?? 0; // Total ingresos brutos del 110
  const r59 = numerico.get(59) ?? 0; // Devoluciones del 110

  // Stats anuales por periodicidad activa
  const bim = items.filter((i) => i.periodicidad === "bimestral");
  const cua = items.filter((i) => i.periodicidad === "cuatrimestral");
  const periodicidadActiva: Periodicidad =
    cua.length > bim.length ? "cuatrimestral" : "bimestral";
  const itemsActivos = periodicidadActiva === "bimestral" ? bim : cua;

  const totales = itemsActivos.reduce(
    (acc, it) => ({
      ingresos_brutos: acc.ingresos_brutos + it.ingresos_brutos,
      devoluciones: acc.devoluciones + it.devoluciones,
      ingresos_netos:
        acc.ingresos_netos + (it.ingresos_brutos - it.devoluciones),
      ingresos_gravados: acc.ingresos_gravados + it.ingresos_gravados,
      ingresos_exentos: acc.ingresos_exentos + it.ingresos_exentos,
      ingresos_no_gravados:
        acc.ingresos_no_gravados + it.ingresos_no_gravados,
      iva_generado: acc.iva_generado + it.iva_generado,
      iva_descontable: acc.iva_descontable + it.iva_descontable,
      saldo_pagar: acc.saldo_pagar + it.saldo_pagar,
      saldo_favor: acc.saldo_favor + it.saldo_favor,
    }),
    {
      ingresos_brutos: 0,
      devoluciones: 0,
      ingresos_netos: 0,
      ingresos_gravados: 0,
      ingresos_exentos: 0,
      ingresos_no_gravados: 0,
      iva_generado: 0,
      iva_descontable: 0,
      saldo_pagar: 0,
      saldo_favor: 0,
    },
  );

  // Cruce contra el F110 · ingresos ordinarios
  // El IVA brutos (cas 39) - devoluciones (cas 40) = ingresos netos del año
  // Debe cuadrar contra los ingresos brutos ordinarios del 110 (R47).
  // R47 trae los ingresos por actividades ordinarias antes de devoluciones.
  // R58 incluye también dividendos (R49-R56) y otros ingresos (R57).
  const ivaIngresosBrutos = totales.ingresos_brutos;
  const ivaIngresosNetos = totales.ingresos_netos;
  const TOLERANCIA = 1000;
  const difContraR47 = ivaIngresosBrutos - r47;
  const difContraR58 = ivaIngresosBrutos - r58;
  const cuadraR47 = Math.abs(difContraR47) <= TOLERANCIA;
  const cuadraR58 = Math.abs(difContraR58) <= TOLERANCIA;

  const cfg = PERIODICIDADES.find((p) => p.id === periodicidadActiva)!;
  const periodosCapturados = itemsActivos.length;

  return (
    <div className="max-w-6xl">
      <ModuloHeader
        titulo="Anexo IVA"
        moduloLabel={`${cfg.numPeriodos} periodos · Formulario 300`}
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        volverLabel="Anexos"
        contexto={`${empresa.razon_social} · AG ${declaracion.ano_gravable}`}
      />

      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Declaraciones de IVA presentadas durante el año gravable (Formulario
        300). Captura cada periodo con sus valores clave o sube el PDF
        oficial. Soporta los 2 regímenes del Art. 600 E.T.: bimestral
        (6 periodos) y cuatrimestral (3 periodos).
      </p>

      {!tablaExiste ? (
        <div className="mb-6 border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          La tabla <span className="font-mono">anexo_iva_declaraciones</span>{" "}
          no existe. Aplica la migración{" "}
          <span className="font-mono">028_anexo_iva.sql</span> en el SQL
          Editor de Supabase para habilitar la persistencia.
        </div>
      ) : null}

      {/* Resumen anual */}
      <section className="mb-8 rounded-md border border-border p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Resumen anual · {cfg.label}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {periodosCapturados} de {cfg.numPeriodos} periodos capturados
          </p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Stat label="Ingresos brutos (cas. 39)" value={totales.ingresos_brutos} />
          <Stat label="Devoluciones (cas. 40)" value={totales.devoluciones} muted />
          <Stat
            label="Ingresos netos (39 − 40)"
            value={totales.ingresos_netos}
            help="Brutos menos devoluciones"
          />
          <Stat label="IVA generado" value={totales.iva_generado} muted />
          <Stat label="IVA descontable" value={totales.iva_descontable} muted />
          <Stat
            label={
              totales.saldo_pagar > totales.saldo_favor
                ? "Saldos a pagar"
                : "Saldos a favor"
            }
            value={Math.max(totales.saldo_pagar, totales.saldo_favor)}
            alert={totales.saldo_pagar > 0}
            success={
              totales.saldo_favor > 0 && totales.saldo_pagar === 0
            }
          />
        </div>
      </section>

      {/* Cruce contra Renta */}
      {periodosCapturados > 0 ? (
        <section
          className={`mb-8 rounded-md border-2 p-5 ${
            cuadraR47
              ? "border-success/40 bg-success/5"
              : "border-amber-500/40 bg-amber-500/5"
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground">
              Cruce contra ingresos ordinarios · F110
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.05em] ${
                cuadraR47
                  ? "border-success/60 bg-success/10 text-success"
                  : "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-500"
              }`}
            >
              {cuadraR47 ? "✓ Conciliado" : "⚠ Diferencia"}
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Lado IVA */}
            <div className="rounded border border-border bg-card p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                Anexo IVA · año
              </p>
              <p className="mt-2 font-serif text-2xl tabular-nums">
                {FMT.format(ivaIngresosBrutos)}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                Σ ingresos brutos (casilla 39)
              </p>
              <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                <p>
                  − Devoluciones:{" "}
                  <span className="font-mono">
                    {FMT.format(totales.devoluciones)}
                  </span>
                </p>
                <p className="mt-0.5 font-medium text-foreground">
                  = Netos:{" "}
                  <span className="font-mono">
                    {FMT.format(ivaIngresosNetos)}
                  </span>
                </p>
              </div>
            </div>

            {/* Lado F110 */}
            <div className="rounded border border-border bg-card p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                Formulario 110
              </p>
              <p className="mt-2 font-serif text-2xl tabular-nums">
                {FMT.format(r47)}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                R47 · Ingresos brutos actividades ordinarias
              </p>
              <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                <p>
                  R59 Devoluciones:{" "}
                  <span className="font-mono">{FMT.format(r59)}</span>
                </p>
                <p>
                  R58 Total brutos:{" "}
                  <span className="font-mono">{FMT.format(r58)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Resultado del cruce */}
          <div className="mt-4 rounded-md bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  IVA brutos − R47
                </p>
                <p
                  className={`mt-1 font-serif text-xl tabular-nums ${
                    cuadraR47 ? "text-success" : "text-amber-700 dark:text-amber-500"
                  }`}
                >
                  {difContraR47 >= 0 ? "+" : ""}
                  {FMT.format(difContraR47)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  IVA brutos − R58 (total ingresos)
                </p>
                <p
                  className={`mt-1 font-serif text-xl tabular-nums ${
                    cuadraR58 ? "text-success" : "text-amber-700 dark:text-amber-500"
                  }`}
                >
                  {difContraR58 >= 0 ? "+" : ""}
                  {FMT.format(difContraR58)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              {cuadraR47
                ? "✓ Los ingresos brutos del IVA cuadran con los ingresos ordinarios del F110 (tolerancia $1.000)."
                : difContraR47 > 0
                  ? "⚠ El IVA reporta más ingresos que el F110. Posibles causas: ingresos no operacionales facturando IVA · operaciones de IVA gravadas que la contabilidad clasificó en otra cuenta · ajustes pendientes."
                  : "⚠ El F110 reporta más ingresos que el IVA. Posibles causas: ingresos no gravados con IVA · dividendos · rendimientos financieros sin facturar IVA."}
            </p>
          </div>
        </section>
      ) : null}

      <IvaGrid
        declId={declId}
        empresaId={empresaId}
        items={items}
        periodicidadActiva={periodicidadActiva}
      />

      {/* Bucket de Storage info */}
      <section className="mt-12 border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Notas técnicas</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Para subir PDFs es necesario crear el bucket{" "}
            <span className="font-mono">anexo-iva-pdfs</span> en Supabase
            Storage (privado, RLS por owner). Si el bucket no existe, los
            datos numéricos se guardan igualmente y el PDF se omite con un
            aviso silencioso.
          </li>
          <li>
            El cruce con el F110 viene del Anexo de Retenciones (R105/R106) y
            del balance contable. El Anexo IVA es informativo · soporta los
            ingresos brutos del año.
          </li>
          <li>
            Cada periodo se identifica por (periodicidad + número). Re-subir
            sobreescribe el registro existente.
          </li>
        </ul>
      </section>

      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="mt-6 inline-block font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver a Anexos
      </Link>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
  success,
  muted,
  help,
}: {
  label: string;
  value: number;
  alert?: boolean;
  success?: boolean;
  muted?: boolean;
  help?: string;
}) {
  const cls = alert
    ? "border-destructive/40 bg-destructive/5"
    : success
      ? "border-success/40 bg-success/5"
      : muted
        ? "border-border bg-muted/20"
        : "border-border";
  return (
    <div className={`border p-3 ${cls}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-xl tabular-nums">
        {FMT.format(value)}
      </p>
      {help ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}
