import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RentaPresuntivaForm } from "./form";

export const metadata = { title: "Anexo 1 · Renta Presuntiva" };

export default async function RentaPresuntivaPage({
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

  // Tarifa de renta presuntiva del año
  const { data: tarifaRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable)
    .eq("codigo", "tarifa_renta_presuntiva")
    .maybeSingle();
  const tarifa = tarifaRow ? Number(tarifaRow.valor) : 0;

  return (
    <div className="max-w-3xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 1 · Renta Presuntiva
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Renta presuntiva = (Patrimonio líquido AG anterior − depuraciones) × tarifa.
        Para AG {declaracion.ano_gravable} la tarifa es{" "}
        <span className="font-medium text-foreground">
          {(tarifa * 100).toFixed(2)}%
        </span>
        . El valor calculado va al renglón 76.
      </p>

      <div className="mt-10">
        <RentaPresuntivaForm
          declId={declId}
          empresaId={empresaId}
          tarifa={tarifa}
          declaracion={declaracion}
        />
      </div>
    </div>
  );
}
