import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubForm } from "./form";

export const metadata = { title: "Anexo 15 · Subcapitalización" };

export default async function SubPage({
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
        Anexo 15 · Subcapitalización
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Limitación a la deducibilidad de intereses pagados a vinculados
        económicos (Art. 118-1 E.T.). Determina cuánta porción de los intereses
        no es deducible por exceder 2 veces el patrimonio líquido.
      </p>

      <div className="mt-10">
        <SubForm declId={declId} empresaId={empresaId} declaracion={declaracion} />
      </div>
    </div>
  );
}
