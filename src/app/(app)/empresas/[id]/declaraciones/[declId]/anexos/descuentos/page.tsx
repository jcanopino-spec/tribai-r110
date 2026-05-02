import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIAS, type Categoria } from "./consts";
import { DescuentoForm } from "./form";
import { DescuentoList } from "./list";

export const metadata = { title: "Anexo 4 · Descuentos" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function DescuentosPage({
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
    .from("anexo_descuentos")
    .select("id, categoria, descripcion, normatividad, base, valor_descuento, created_at")
    .eq("declaracion_id", declId)
    .order("categoria")
    .order("created_at");

  const todas = items ?? [];
  const total = todas.reduce((s, d) => s + Number(d.valor_descuento), 0);
  const totalesPorCategoria = new Map<Categoria, number>();
  for (const d of todas) {
    const cat = d.categoria as Categoria;
    totalesPorCategoria.set(cat, (totalesPorCategoria.get(cat) ?? 0) + Number(d.valor_descuento));
  }

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 4 · Descuentos Tributarios
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Suma de todos los descuentos tributarios → renglón 93 del Formulario 110.
        Recuerda los topes del Art. 259 E.T. (75 % del impuesto básico de renta).
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {CATEGORIAS.map((c) => (
          <Stat
            key={c.id}
            label={c.label}
            value={totalesPorCategoria.get(c.id) ?? 0}
          />
        ))}
        <Stat label="Total R93" value={total} emphasis />
      </div>

      <div className="mt-12">
        <DescuentoForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <DescuentoList items={todas} declId={declId} empresaId={empresaId} />
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
    <div className={`border p-5 ${emphasis ? "border-foreground bg-foreground text-background" : "border-border"}`}>
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
