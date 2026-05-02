import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GmfForm } from "./form";
import { GmfList } from "./list";

export const metadata = { title: "Anexo 10 · GMF" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function GmfPage({
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
    .from("anexo_gmf")
    .select("id, entidad, periodo, valor_gmf, observacion")
    .eq("declaracion_id", declId)
    .order("created_at");

  const todos = items ?? [];
  const totalGmf = todos.reduce((s, i) => s + Number(i.valor_gmf), 0);
  const deducible50 = totalGmf * 0.5;

  return (
    <div className="max-w-4xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 10 · GMF
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Gravamen a Movimientos Financieros (4×1000). El 50% del GMF efectivamente
        pagado es deducible aunque no tenga relación de causalidad con la
        actividad económica (Art. 115 E.T.).
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Stat label="Total GMF pagado" value={totalGmf} />
        <Stat label="50% deducible" value={deducible50} emphasis />
      </div>

      <div className="mt-12">
        <GmfForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <GmfList items={todos} declId={declId} empresaId={empresaId} />
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
