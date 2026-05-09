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
    .select("id, ano_gravable, empresa_id")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("razon_social")
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
    ingresos_no_gravados: Number(r.ingresos_no_gravados),
    ingresos_exentos: Number(r.ingresos_exentos),
    ingresos_gravados: Number(r.ingresos_gravados),
    iva_generado: Number(r.iva_generado),
    iva_descontable: Number(r.iva_descontable),
    saldo_pagar: Number(r.saldo_pagar),
    saldo_favor: Number(r.saldo_favor),
  }));

  // Stats anuales por periodicidad activa
  const bim = items.filter((i) => i.periodicidad === "bimestral");
  const cua = items.filter((i) => i.periodicidad === "cuatrimestral");
  const periodicidadActiva: Periodicidad =
    cua.length > bim.length ? "cuatrimestral" : "bimestral";
  const itemsActivos = periodicidadActiva === "bimestral" ? bim : cua;

  const totales = itemsActivos.reduce(
    (acc, it) => ({
      ingresos_brutos: acc.ingresos_brutos + it.ingresos_brutos,
      ingresos_gravados: acc.ingresos_gravados + it.ingresos_gravados,
      iva_generado: acc.iva_generado + it.iva_generado,
      iva_descontable: acc.iva_descontable + it.iva_descontable,
      saldo_pagar: acc.saldo_pagar + it.saldo_pagar,
      saldo_favor: acc.saldo_favor + it.saldo_favor,
    }),
    {
      ingresos_brutos: 0,
      ingresos_gravados: 0,
      iva_generado: 0,
      iva_descontable: 0,
      saldo_pagar: 0,
      saldo_favor: 0,
    },
  );

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
          <Stat label="Ingresos brutos" value={totales.ingresos_brutos} />
          <Stat label="Ingresos gravados" value={totales.ingresos_gravados} />
          <Stat
            label="IVA neto pagado"
            value={Math.max(0, totales.iva_generado - totales.iva_descontable)}
            help="Generado − Descontable"
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
