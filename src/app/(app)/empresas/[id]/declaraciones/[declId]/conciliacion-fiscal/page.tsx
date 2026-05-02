import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UtilidadForm } from "./utilidad-form";
import { PartidaForm } from "./partida-form";
import { PartidasList } from "./list";

export const metadata = { title: "Conciliación Fiscal" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function ConciliacionPage({
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

  const { data: partidas } = await supabase
    .from("conciliacion_partidas")
    .select("id, tipo, signo, concepto, valor, observacion")
    .eq("declaracion_id", declId)
    .order("created_at");

  const todas = (partidas ?? []).map((p) => ({
    ...p,
    valor: Number(p.valor),
  }));

  const utilidadContable = Number(declaracion.cf_utilidad_contable ?? 0);

  // Renta líquida fiscal del formulario (R72)
  const { data: r72Row } = await supabase
    .from("form110_valores")
    .select("valor")
    .eq("declaracion_id", declId)
    .eq("numero", 72)
    .maybeSingle();
  const r72 = r72Row ? Number(r72Row.valor) : 0;

  const sumaMasPerm = todas
    .filter((p) => p.tipo === "permanente" && p.signo === "mas")
    .reduce((s, p) => s + p.valor, 0);
  const sumaMenosPerm = todas
    .filter((p) => p.tipo === "permanente" && p.signo === "menos")
    .reduce((s, p) => s + p.valor, 0);
  const sumaMasTemp = todas
    .filter((p) => p.tipo === "temporal" && p.signo === "mas")
    .reduce((s, p) => s + p.valor, 0);
  const sumaMenosTemp = todas
    .filter((p) => p.tipo === "temporal" && p.signo === "menos")
    .reduce((s, p) => s + p.valor, 0);

  const netoPerm = sumaMasPerm - sumaMenosPerm;
  const netoTemp = sumaMasTemp - sumaMenosTemp;
  const rentaCalculada = utilidadContable + netoPerm + netoTemp;
  const diff = r72 - rentaCalculada;
  const cuadra = Math.abs(diff) < 1;

  // Estimado de impuesto diferido (sólo informativo, tarifa 35%)
  const tarifa = 0.35;
  const impuestoDiferidoNeto = netoTemp * tarifa;

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Conciliación Fiscal
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Explica las diferencias entre la utilidad contable antes de impuestos
        y la renta líquida fiscal por concepto. Las diferencias permanentes no
        se revierten; las temporales generan impuesto diferido.
      </p>

      {/* Punto de partida */}
      <section className="mt-10">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          Punto de partida
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Utilidad (o pérdida) contable antes del impuesto sobre la renta. Tomar
          del Estado de Resultados.
        </p>
        <div className="mt-4 max-w-md">
          <UtilidadForm declId={declId} empresaId={empresaId} initialValue={utilidadContable} />
        </div>
      </section>

      {/* Resumen visual de la conciliación */}
      <section className="mt-12">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          Conciliación en cascada
        </h2>
        <div className="mt-5 border border-border">
          <Row label="Utilidad contable antes de impuestos" value={utilidadContable} />
          <Row label="(+) Permanentes que suman" value={sumaMasPerm} muted />
          <Row label="(−) Permanentes que restan" value={-sumaMenosPerm} muted />
          <Row label="(+) Temporales que suman" value={sumaMasTemp} muted />
          <Row label="(−) Temporales que restan" value={-sumaMenosTemp} muted />
          <Row
            label="Renta líquida fiscal calculada"
            value={rentaCalculada}
            emphasis
          />
        </div>
      </section>

      {/* Cruce con formulario */}
      <section className="mt-10">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          Cruce con el formulario
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat label="Calculada" value={rentaCalculada} />
          <Stat label="R72 actual del 110" value={r72} />
          <Stat label="Diferencia" value={diff} alert={!cuadra} emphasis />
        </div>
        <p
          className={`mt-3 text-xs ${
            cuadra ? "text-success" : "text-destructive"
          }`}
        >
          {cuadra
            ? "✓ La conciliación cuadra con la renta líquida del formulario."
            : `⚠ Diferencia de ${FMT.format(diff)}. Revisa partidas faltantes o el Balance Fiscal.`}
        </p>
      </section>

      {/* Impuesto diferido informativo */}
      <section className="mt-10 border border-dashed border-border p-5">
        <h3 className="font-serif text-xl">Impacto en impuesto diferido</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Estimación informativa con tarifa nominal {(tarifa * 100).toFixed(0)}%.
          Las diferencias temporales generan activos o pasivos por impuesto
          diferido (NIC 12 / Sección 29 NIIF).
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Stat label="Diferencias temporales netas" value={netoTemp} />
          <Stat
            label={
              impuestoDiferidoNeto >= 0
                ? "Activo por impuesto diferido (estimado)"
                : "Pasivo por impuesto diferido (estimado)"
            }
            value={Math.abs(impuestoDiferidoNeto)}
          />
        </div>
      </section>

      {/* Form de partidas */}
      <div className="mt-12">
        <PartidaForm declId={declId} empresaId={empresaId} />
      </div>

      {/* Listado */}
      <div className="mt-12">
        <PartidasList items={todas} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: number;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0 ${
        emphasis ? "bg-muted/40" : ""
      }`}
    >
      <span
        className={`text-sm ${
          muted ? "text-muted-foreground" : emphasis ? "font-medium" : ""
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono ${
          emphasis ? "font-serif text-xl tracking-[-0.02em]" : "text-sm"
        }`}
      >
        {value < 0 ? "−" : ""}
        {FMT.format(Math.abs(value))}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
  emphasis,
}: {
  label: string;
  value: number;
  alert?: boolean;
  emphasis?: boolean;
}) {
  const cls = emphasis
    ? "border-foreground bg-foreground text-background"
    : "border-border";
  return (
    <div className={`border p-5 ${cls}`}>
      <p
        className={`font-mono text-xs uppercase tracking-[0.05em] ${
          emphasis ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 font-serif text-2xl tracking-[-0.02em] ${
          alert && !emphasis ? "text-destructive" : ""
        }`}
      >
        {value < 0 ? "−" : ""}
        {FMT.format(Math.abs(value))}
      </p>
    </div>
  );
}
