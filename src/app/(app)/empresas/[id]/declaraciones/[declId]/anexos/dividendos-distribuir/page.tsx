import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DivDistForm } from "./form";
import { DivDistList } from "./list";

export const metadata = { title: "Dividendos a Distribuir" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function DivDistPage({
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
    .from("anexo_dividendos_distribuir")
    .select(
      "id, socio, nit, participacion_pct, dividendo_no_gravado, dividendo_gravado, retencion_aplicable, observacion",
    )
    .eq("declaracion_id", declId)
    .order("socio");

  const todos = items ?? [];
  const totalPart = todos.reduce((s, i) => s + Number(i.participacion_pct), 0);
  const totalNoGravado = todos.reduce((s, i) => s + Number(i.dividendo_no_gravado), 0);
  const totalGravado = todos.reduce((s, i) => s + Number(i.dividendo_gravado), 0);
  const totalRet = todos.reduce((s, i) => s + Number(i.retencion_aplicable), 0);
  const totalDist = totalNoGravado + totalGravado;

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Dividendos a Distribuir
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Distribución de dividendos a socios o accionistas. La parte no gravada
        proviene de utilidades que ya pagaron renta en cabeza de la sociedad
        (Art. 49 E.T.). La parte gravada se somete a tarifa según el tipo de
        beneficiario (Arts. 242, 242-1, 245).
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Total distribuido" value={totalDist} emphasis />
        <Stat label="Retenciones" value={totalRet} />
        <Stat label="Suma participaciones" value={totalPart} pct />
      </div>

      {Math.abs(totalPart - 100) > 0.01 && todos.length > 0 ? (
        <p className="mt-3 text-xs text-destructive">
          ⚠ La suma de participaciones es {totalPart.toFixed(2)}%. Debería sumar 100%.
        </p>
      ) : null}

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Mini label="No gravado" value={totalNoGravado} />
        <Mini label="Gravado" value={totalGravado} />
      </div>

      <div className="mt-12">
        <DivDistForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <DivDistList items={todos} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
  pct,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  pct?: boolean;
}) {
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
      <p className="mt-2 font-serif text-2xl tracking-[-0.02em]">
        {pct ? `${value.toFixed(2)}%` : FMT.format(value)}
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm">{FMT.format(value)}</p>
    </div>
  );
}
