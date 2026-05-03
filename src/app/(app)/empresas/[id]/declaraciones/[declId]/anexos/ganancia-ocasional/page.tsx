import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GoForm } from "./form";
import { GoList } from "./list";

export const metadata = { title: "Anexo 8 · Ganancia Ocasional" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function GoPage({
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
    .from("anexo_ganancia_ocasional")
    .select("id, categoria, concepto, precio_venta, costo_fiscal, no_gravada, recuperacion_depreciacion, created_at")
    .eq("declaracion_id", declId)
    .order("categoria")
    .order("created_at");

  const todas = items ?? [];
  const totalPrecio = todas.reduce((s, x) => s + Number(x.precio_venta), 0);
  const totalCosto = todas.reduce((s, x) => s + Number(x.costo_fiscal), 0);
  const totalNoGravada = todas.reduce((s, x) => s + Number(x.no_gravada), 0);
  const goGravable = Math.max(0, totalPrecio - totalCosto - totalNoGravada);
  const impuestoGo = goGravable * 0.15;

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 8 · Ganancias Ocasionales
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Suma por categoría → renglones 80 (ingresos), 81 (costos) y 82 (no
        gravadas y exentas). Renglón 83 = max(0, 80 − 81 − 82) y renglón 97 = 83 × 15 %.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Stat label="Ingresos GO (R80)" value={totalPrecio} />
        <Stat label="Costos GO (R81)" value={totalCosto} />
        <Stat label="No gravadas (R82)" value={totalNoGravada} />
        <Stat label="GO gravable (R83)" value={goGravable} emphasis />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Impuesto de ganancia ocasional sobre la base (15 %): {FMT.format(impuestoGo)} (renglón 97)
      </p>

      <div className="mt-12">
        <GoForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <GoList items={todas} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`border p-5 ${
        emphasis ? "border-foreground bg-foreground text-background" : "border-border"
      }`}
    >
      <p
        className={`font-mono text-xs uppercase tracking-[0.05em] ${
          emphasis ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p className="mt-2 font-serif text-2xl tracking-[-0.02em]">
        {FMT.format(value)}
      </p>
    </div>
  );
}
