import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IvaCapitalForm } from "./form";
import { IvaCapitalList } from "./list";

export const metadata = { title: "Anexo 13 · IVA Bienes de Capital" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function IvaCapitalPage({
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
    .from("anexo_iva_capital")
    .select("id, factura, fecha, bien, proveedor, base, iva_pagado, observacion")
    .eq("declaracion_id", declId)
    .order("created_at");

  const todos = items ?? [];
  const totalBase = todos.reduce((s, i) => s + Number(i.base), 0);
  const totalIva = todos.reduce((s, i) => s + Number(i.iva_pagado), 0);

  return (
    <div className="max-w-4xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 13 · IVA Bienes de Capital
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Adquisición o importación de bienes de capital. El IVA pagado puede
        descontarse del impuesto sobre la renta del año en que se efectúe el
        pago (Art. 258-1 E.T.). Alimenta el Anexo 4 · Descuentos.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Stat label="Base total" value={totalBase} />
        <Stat label="IVA descontable" value={totalIva} emphasis />
      </div>

      <div className="mt-12">
        <IvaCapitalForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <IvaCapitalList items={todos} declId={declId} empresaId={empresaId} />
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
