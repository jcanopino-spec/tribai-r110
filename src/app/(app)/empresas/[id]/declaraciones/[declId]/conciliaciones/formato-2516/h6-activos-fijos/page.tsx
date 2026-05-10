import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModuloHeader } from "@/components/modulo-header";
import { H6Form } from "./form";
import type { F2516H6Captura } from "@/engine/f2516-h6";

export const metadata = { title: "F2516 H6 Activos Fijos" };

export default async function H6Page({
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

  const [{ data: rowsRaw }, { data: r40r42 }] = await Promise.all([
    supabase
      .from("formato_2516_h6_activos_fijos")
      .select("*")
      .eq("declaracion_id", declId),
    supabase
      .from("form110_valores")
      .select("numero, valor")
      .eq("declaracion_id", declId)
      .in("numero", [40, 42]),
  ]);

  const initial: F2516H6Captura[] = (rowsRaw ?? []).map((d) => ({
    declaracion_id: d.declaracion_id as string,
    categoria_id: d.categoria_id as string,
    categoria: d.categoria as string,
    saldo_inicial: Number(d.saldo_inicial),
    adiciones: Number(d.adiciones),
    retiros: Number(d.retiros),
    deprec_acumulada: Number(d.deprec_acumulada),
    deprec_ano: Number(d.deprec_ano),
    ajuste_fiscal: Number(d.ajuste_fiscal),
    observacion: (d.observacion as string | null) ?? null,
  }));

  const r40r42F110 = (r40r42 ?? []).reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div className="max-w-7xl">
      <ModuloHeader
        titulo="F2516 · H6 ACTIVOS FIJOS"
        moduloLabel="Movimiento del año · contable vs fiscal"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
        volverLabel="Formato 2516"
        contexto={`${empresa.razon_social} · AG ${declaracion.ano_gravable}`}
      />
      <H6Form declId={declId} empresaId={empresaId} initial={initial} r40r42F110={r40r42F110} />
    </div>
  );
}
