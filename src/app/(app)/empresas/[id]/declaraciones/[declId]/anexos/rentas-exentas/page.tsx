import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RentasExentasForm } from "./form";
import { RentasExentasList } from "./list";

export const metadata = { title: "Anexo 19 · Rentas Exentas" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function RentasExentasPage({
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
    .from("anexo_rentas_exentas")
    .select("id, descripcion, normatividad, valor_fiscal, created_at")
    .eq("declaracion_id", declId)
    .order("created_at");

  const todas = items ?? [];
  const total = todas.reduce((s, r) => s + Number(r.valor_fiscal), 0);

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 19 · Rentas Exentas
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Rentas exentas según el Art. 235-2 E.T. y otras normas. La suma alimenta el
        renglón 77 del Formulario 110.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="border border-border p-5">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Total Anexo 19
          </p>
          <p className="mt-2 font-serif text-3xl tracking-[-0.02em]">{FMT.format(total)}</p>
        </div>
        <div className="border border-foreground bg-foreground p-5 text-background">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-background/70">
            Renglón 77
          </p>
          <p className="mt-2 font-serif text-3xl tracking-[-0.02em]">{FMT.format(total)}</p>
        </div>
      </div>

      <div className="mt-12">
        <RentasExentasForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <RentasExentasList items={todas} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}
