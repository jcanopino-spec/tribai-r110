import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VentaAfForm } from "./form";
import { VentaAfList, calcularResultado } from "./list";

export const metadata = { title: "Venta de Activos Fijos" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function VentaAfPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: items } = await supabase
    .from("anexo_venta_activos_fijos")
    .select(
      "id, posesion_mas_2_anos, fecha_compra, fecha_venta, detalle_activo, nit_comprador, precio_venta, costo_fiscal, depreciacion_acumulada, reajustes_fiscales, observacion",
    )
    .eq("declaracion_id", declId)
    .order("posesion_mas_2_anos", { ascending: false })
    .order("fecha_venta", { nullsFirst: false });

  const todos = (items ?? []).map((i) => ({
    ...i,
    precio_venta: Number(i.precio_venta),
    costo_fiscal: Number(i.costo_fiscal),
    depreciacion_acumulada: Number(i.depreciacion_acumulada),
    reajustes_fiscales: Number(i.reajustes_fiscales),
  }));

  // Totales por categoría · alimentan F110
  const goItems = todos.filter((i) => i.posesion_mas_2_anos);
  const ordItems = todos.filter((i) => !i.posesion_mas_2_anos);

  const goTotalIngresos = goItems.reduce((s, i) => s + i.precio_venta, 0);
  const goTotalCostos = goItems.reduce(
    (s, i) =>
      s +
      Math.max(0, i.costo_fiscal - i.depreciacion_acumulada + i.reajustes_fiscales),
    0,
  );
  const goUtilidad = goItems.reduce(
    (s, i) => s + calcularResultado(i).utilidad,
    0,
  );
  const goPerdida = goItems.reduce(
    (s, i) => s + calcularResultado(i).perdida,
    0,
  );

  const ordUtilidad = ordItems.reduce(
    (s, i) => s + calcularResultado(i).utilidad,
    0,
  );
  const ordPerdida = ordItems.reduce(
    (s, i) => s + calcularResultado(i).perdida,
    0,
  );

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Venta de Activos Fijos
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Detalle de las ventas de activos fijos del año. La utilidad se calcula
        como{" "}
        <span className="font-mono">
          precio − (costo − depreciación + reajustes)
        </span>
        . Las ventas con posesión {">"} 2 años alimentan la Ganancia Ocasional
        (R80/R81). Posesión ≤ 2 años es informativa (los ingresos/costos ya
        están en R47/R66 vía balance).
      </p>

      <section className="mt-8">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          Posesión {">"} 2 años · Ganancia Ocasional
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          <Stat label="Ingresos GO (R80)" value={goTotalIngresos} />
          <Stat label="Costos GO (R81)" value={goTotalCostos} />
          <Stat label="Utilidad neta" value={goUtilidad} success />
          <Stat label="Pérdida" value={goPerdida} alert={goPerdida > 0} />
        </div>
      </section>

      {ordItems.length > 0 ? (
        <section className="mt-6">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Posesión ≤ 2 años · Renta líquida ordinaria (informativo)
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Stat label="Utilidad" value={ordUtilidad} success />
            <Stat label="Pérdida" value={ordPerdida} alert={ordPerdida > 0} />
          </div>
        </section>
      ) : null}

      <div className="mt-12">
        <VentaAfForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <VentaAfList items={todos} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  success,
  alert,
}: {
  label: string;
  value: number;
  success?: boolean;
  alert?: boolean;
}) {
  const cls = alert
    ? "border-destructive/40 bg-destructive/5"
    : success && value > 0
      ? "border-success/40 bg-success/5"
      : "border-border";
  return (
    <div className={`border p-4 ${cls}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl tracking-[-0.02em] tabular-nums">
        {FMT.format(value)}
      </p>
    </div>
  );
}
