import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DcForm } from "./form";

export const metadata = { title: "Anexo 12 · Deterioro de Cartera" };

export default async function DcPage({
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

  return (
    <div className="max-w-3xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 12 · Deterioro de Cartera
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Cartera por antigüedad (Art. 145 E.T., Decreto 187/1975). Calcula la
        provisión fiscal aceptable según el método elegido. La diferencia con
        la provisión contable se ajusta en el Balance Fiscal.
      </p>

      <div className="mt-10">
        <DcForm declId={declId} empresaId={empresaId} declaracion={declaracion} />
      </div>
    </div>
  );
}
