import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SegSocialForm } from "./form";
import { SegSocialList } from "./list";

export const metadata = { title: "Anexo 21 · Seguridad Social" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function SegSocialPage({
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
    .from("anexo_seg_social")
    .select(
      "id, empleado, cedula, salario, aporte_salud, aporte_pension, aporte_arl, aporte_parafiscales, observacion",
    )
    .eq("declaracion_id", declId)
    .order("empleado");

  const todos = items ?? [];
  const totalSalario = todos.reduce((s, i) => s + Number(i.salario), 0);
  const totalSalud = todos.reduce((s, i) => s + Number(i.aporte_salud), 0);
  const totalPension = todos.reduce((s, i) => s + Number(i.aporte_pension), 0);
  const totalArl = todos.reduce((s, i) => s + Number(i.aporte_arl), 0);
  const totalPara = todos.reduce((s, i) => s + Number(i.aporte_parafiscales), 0);
  const totalAportes = totalSalud + totalPension + totalArl + totalPara;

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 21 · Seguridad Social
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Aportes a salud, pensión, ARL y parafiscales. Para que los pagos
        laborales sean deducibles, los aportes deben estar efectivamente pagados
        antes de presentar la declaración (Art. 108 E.T.).
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Total salarios" value={totalSalario} />
        <Stat label="Total aportes" value={totalAportes} />
        <Stat label="Empleados" value={todos.length} count />
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-4">
        <Mini label="Salud" value={totalSalud} />
        <Mini label="Pensión" value={totalPension} />
        <Mini label="ARL" value={totalArl} />
        <Mini label="Parafiscales" value={totalPara} />
      </div>

      <div className="mt-12">
        <SegSocialForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <SegSocialList items={todos} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  count,
}: {
  label: string;
  value: number;
  count?: boolean;
}) {
  return (
    <div className="border border-border p-5">
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-serif text-2xl tracking-[-0.02em]">
        {count ? value : FMT.format(value)}
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
