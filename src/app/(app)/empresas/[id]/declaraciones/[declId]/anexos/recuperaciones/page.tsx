import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecuperacionForm } from "./form";
import { RecuperacionList } from "./list";

export const metadata = { title: "Anexo 17 · Recuperaciones" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function RecuperacionesPage({
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
    .from("anexo_recuperaciones")
    .select("id, concepto, descripcion, valor, observacion, created_at")
    .eq("declaracion_id", declId)
    .order("created_at");

  const todas = items ?? [];
  const total = todas.reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 17 · Recuperación de Deducciones
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Ingresos fiscales por reversión o recuperación de partidas que disminuyeron
        rentas en años anteriores (deterioros, provisiones, pasivos estimados,
        cartera castigada, etc.). La suma alimenta el renglón 70 del Formulario 110.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="border border-border p-5">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Total Anexo 17
          </p>
          <p className="mt-2 font-serif text-3xl tracking-[-0.02em]">{FMT.format(total)}</p>
        </div>
        <div className="border border-foreground bg-foreground p-5 text-background">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-background/70">
            Renglón 70
          </p>
          <p className="mt-2 font-serif text-3xl tracking-[-0.02em]">{FMT.format(total)}</p>
        </div>
      </div>

      <div className="mt-12">
        <RecuperacionForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <RecuperacionList items={todas} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}
