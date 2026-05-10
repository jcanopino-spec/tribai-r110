import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModuloHeader } from "@/components/modulo-header";
import { H4Form } from "./form";
import type { F2516H4Captura } from "@/engine/f2516-h4";

export const metadata = { title: "F2516 H4 Imp Diferido" };

export default async function H4Page({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, empresa_id")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();
  const { data: empresa } = await supabase
    .from("empresas")
    .select("razon_social, nit")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  const { data: rows } = await supabase
    .from("formato_2516_h4_imp_diferido")
    .select("*")
    .eq("declaracion_id", declId);

  const initial: F2516H4Captura[] = (rows ?? []).map((d) => ({
    declaracion_id: d.declaracion_id as string,
    categoria_id: d.categoria_id as string,
    tipo: d.tipo as "atd" | "ptd",
    base_contable: Number(d.base_contable),
    base_fiscal: Number(d.base_fiscal),
    tarifa: Number(d.tarifa),
    observacion: (d.observacion as string | null) ?? null,
  }));

  return (
    <div className="max-w-6xl">
      <ModuloHeader
        titulo="F2516 · H4 IMPUESTO DIFERIDO"
        moduloLabel="NIC 12 · Diferencias temporarias deducibles e imponibles"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
        volverLabel="Formato 2516"
        contexto={`${empresa.razon_social} · AG ${declaracion.ano_gravable}`}
      />
      <H4Form declId={declId} empresaId={empresaId} initial={initial} />
    </div>
  );
}
