import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IcaForm } from "./form";
import { IcaList } from "./list";

export const metadata = { title: "ICA" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function IcaPage({
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
    .from("anexo_ica")
    .select("id, municipio, base_gravable, tarifa_milaje, valor_pagado, observacion")
    .eq("declaracion_id", declId)
    .order("created_at");

  const todos = items ?? [];
  const totalPagado = todos.reduce((s, i) => s + Number(i.valor_pagado), 0);
  const descuento50 = totalPagado * 0.5;

  return (
    <div className="max-w-4xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        ICA
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Pagos de Industria y Comercio por municipio. El total pagado puede
        deducirse 100% como gasto (Art. 115 E.T.) o usarse 50% como descuento
        tributario.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Stat label="Total pagado" value={totalPagado} />
        <Stat label="50% descuento" value={descuento50} emphasis />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Ten en cuenta que ICA no se duplica: si tomas el descuento del 50%,
        no puedes deducir esa misma porción como gasto.
      </p>

      <div className="mt-12">
        <IcaForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <IcaList items={todos} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  const cls = emphasis ? "border-foreground bg-foreground text-background" : "border-border";
  return (
    <div className={`border p-5 ${cls}`}>
      <p
        className={`font-mono text-xs uppercase tracking-[0.05em] ${
          emphasis ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p className="mt-2 font-serif text-2xl tracking-[-0.02em]">{FMT.format(value)}</p>
    </div>
  );
}
