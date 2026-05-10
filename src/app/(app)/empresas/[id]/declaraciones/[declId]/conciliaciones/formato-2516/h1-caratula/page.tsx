import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadF2516H1 } from "@/lib/f2516-hojas";
import { ModuloHeader } from "@/components/modulo-header";
import { H1Form } from "./form";

export const metadata = { title: "F2516 H1 Carátula" };

export default async function H1Page({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, empresa_id, fecha_vencimiento")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, razon_social, nit, dv, regimen_codigo, ciiu_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  const caratula = await loadF2516H1(supabase, declId);

  return (
    <div className="max-w-5xl">
      <ModuloHeader
        titulo="F2516 · H1 CARÁTULA"
        moduloLabel="Datos del declarante · Resolución DIAN 71/2019"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
        volverLabel="Formato 2516"
        contexto={`${empresa.razon_social} · NIT ${empresa.nit} · AG ${declaracion.ano_gravable}`}
      />

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Stat label="NIT" value={`${empresa.nit}-${empresa.dv ?? ""}`} mono />
        <Stat label="Régimen" value={empresa.regimen_codigo ?? "—"} mono />
        <Stat label="CIIU" value={empresa.ciiu_codigo ?? "—"} mono />
      </div>

      <H1Form
        declId={declId}
        empresaId={empresaId}
        initial={caratula}
        empresa={empresa}
        anoGravable={declaracion.ano_gravable}
      />
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 ${mono ? "font-mono" : ""} text-base font-semibold`}>{value}</p>
    </div>
  );
}
