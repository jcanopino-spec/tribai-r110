import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TIPOS, type Tipo } from "./consts";
import { CompensacionForm } from "./form";
import { CompensacionList } from "./list";

export const metadata = { title: "Anexo 20 · Compensaciones" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function CompensacionesPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: items } = await supabase
    .from("anexo_compensaciones")
    .select("id, tipo, ano_origen, perdida_original, compensar, observacion, created_at")
    .eq("declaracion_id", declId)
    .order("tipo")
    .order("ano_origen");

  const todas = items ?? [];
  const totalPerdidas = todas
    .filter((c) => c.tipo === "perdida")
    .reduce((s, c) => s + Number(c.compensar), 0);
  const totalExcesos = todas
    .filter((c) => c.tipo === "exceso_rp")
    .reduce((s, c) => s + Number(c.compensar), 0);
  const total = totalPerdidas + totalExcesos;

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 20 · Compensación de Pérdidas
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Compensaciones de pérdidas fiscales (Art. 147 E.T., 12 años) y excesos de renta
        presuntiva sobre renta líquida ordinaria (5 años). La suma alimenta el renglón 74.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Pérdidas a compensar" value={totalPerdidas} />
        <Stat label="Excesos RP a compensar" value={totalExcesos} />
        <Stat label="Renglón 74" value={total} emphasis />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        El total se limita por la renta líquida del período (R72). El cálculo del 110
        respeta ese tope.
      </p>

      <div className="mt-12">
        <CompensacionForm declId={declId} empresaId={empresaId} anoActual={declaracion.ano_gravable} />
      </div>

      <div className="mt-12">
        <CompensacionList items={todas} declId={declId} empresaId={empresaId} />
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
      <p className="mt-2 font-serif text-3xl tracking-[-0.02em]">{FMT.format(value)}</p>
    </div>
  );
}
