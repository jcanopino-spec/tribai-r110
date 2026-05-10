import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModuloHeader } from "@/components/modulo-header";
import { H5Form } from "./form";
import type { F2516H5Captura, F2516H5Conciliacion } from "@/engine/f2516-h5";

export const metadata = { title: "F2516 H5 Ingresos y Facturación" };

export default async function H5Page({
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

  const [{ data: ingRows }, { data: concRow }, { data: valoresR47R57 }] = await Promise.all([
    supabase.from("formato_2516_h5_ingresos").select("*").eq("declaracion_id", declId),
    supabase
      .from("formato_2516_h5_conciliacion")
      .select("*")
      .eq("declaracion_id", declId)
      .maybeSingle(),
    supabase
      .from("form110_valores")
      .select("numero, valor")
      .eq("declaracion_id", declId)
      .in("numero", [47, 57]),
  ]);

  const initialIngresos: F2516H5Captura[] = (ingRows ?? []).map((d) => ({
    declaracion_id: d.declaracion_id as string,
    concepto_id: d.concepto_id as string,
    concepto: d.concepto as string,
    gravados: Number(d.gravados),
    exentos: Number(d.exentos),
    excluidos: Number(d.excluidos),
    exportacion: Number(d.exportacion),
    observacion: (d.observacion as string | null) ?? null,
  }));

  const initialConciliacion: F2516H5Conciliacion | null = concRow
    ? {
        declaracion_id: concRow.declaracion_id as string,
        total_facturado_dian: Number(concRow.total_facturado_dian),
        notas_credito_emitidas: Number(concRow.notas_credito_emitidas),
        notas_debito_emitidas: Number(concRow.notas_debito_emitidas),
        observacion: (concRow.observacion as string | null) ?? null,
      }
    : null;

  const ingresosF110 = (valoresR47R57 ?? []).reduce(
    (s, r) => s + Math.abs(Number(r.valor)),
    0,
  );

  return (
    <div className="max-w-7xl">
      <ModuloHeader
        titulo="F2516 · H5 INGRESOS Y FACTURACIÓN"
        moduloLabel="Detalle por concepto · cruce con factura electrónica DIAN"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
        volverLabel="Formato 2516"
        contexto={`${empresa.razon_social} · AG ${declaracion.ano_gravable}`}
      />
      <H5Form
        declId={declId}
        empresaId={empresaId}
        initialIngresos={initialIngresos}
        initialConciliacion={initialConciliacion}
        ingresosF110={ingresosF110}
      />
    </div>
  );
}
