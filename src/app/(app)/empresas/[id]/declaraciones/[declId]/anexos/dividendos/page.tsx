import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS } from "./consts";
import { DividendoForm } from "./form";
import { DividendoList } from "./list";

export const metadata = { title: "Dividendos" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function DividendosPage({
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
    .from("anexo_dividendos")
    .select("*")
    .eq("declaracion_id", declId)
    .order("created_at");

  const todos = items ?? [];
  const totales = {
    no_constitutivos: todos.reduce((s, i) => s + Number(i.no_constitutivos), 0),
    distribuidos_no_residentes: todos.reduce((s, i) => s + Number(i.distribuidos_no_residentes), 0),
    gravados_tarifa_general: todos.reduce((s, i) => s + Number(i.gravados_tarifa_general), 0),
    gravados_persona_natural_dos: todos.reduce(
      (s, i) => s + Number(i.gravados_persona_natural_dos),
      0,
    ),
    gravados_personas_extranjeras: todos.reduce(
      (s, i) => s + Number(i.gravados_personas_extranjeras),
      0,
    ),
    gravados_art_245: todos.reduce((s, i) => s + Number(i.gravados_art_245), 0),
    gravados_tarifa_l1819: todos.reduce((s, i) => s + Number(i.gravados_tarifa_l1819), 0),
    gravados_proyectos: todos.reduce((s, i) => s + Number(i.gravados_proyectos), 0),
  };
  const totalGeneral = Object.values(totales).reduce((s, v) => s + v, 0);

  return (
    <div className="max-w-6xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Ingresos por Dividendos
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Dividendos recibidos por categoría tributaria. Cada categoría alimenta su
        renglón específico (49 a 56) en el Formulario 110. La suma total se incluye
        en los ingresos brutos.
      </p>

      <div className="mt-8 grid gap-3 md:grid-cols-4">
        {CATEGORIAS.map((c) => (
          <div key={c.id} className="border border-border p-4">
            <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              R{c.renglon} · {c.short}
            </p>
            <p className="mt-1 font-serif text-xl tracking-[-0.02em]">
              {FMT.format(totales[c.id])}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 border border-foreground bg-foreground p-4 text-background">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-background/70">
          Total ingresos por dividendos
        </p>
        <p className="mt-1 font-serif text-3xl tracking-[-0.02em]">{FMT.format(totalGeneral)}</p>
      </div>

      <div className="mt-12">
        <DividendoForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <DividendoList items={todos} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}
