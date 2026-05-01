import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SECCIONES_MAPEABLES } from "@/lib/forms/form110-2025";
import { HomologarForm } from "./homologar-form";

export const metadata = { title: "Homologar cuentas" };

export default async function HomologarPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, empresa:empresas(id, razon_social)")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  // Cuentas auxiliares (>=6 dígitos) sin renglón asignado del último balance
  const { data: balance } = await supabase
    .from("balance_pruebas")
    .select("id")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sinMapear = balance
    ? (
        await supabase
          .from("balance_prueba_lineas")
          .select("cuenta, nombre, saldo")
          .eq("balance_id", balance.id)
          .is("renglon_110", null)
      ).data ?? []
    : [];

  // Solo auxiliares (>= 6 dígitos), agrupadas
  const grupo = new Map<string, { cuenta: string; nombre: string | null; saldo: number }>();
  for (const l of sinMapear) {
    if (l.cuenta.length < 6) continue;
    const prev = grupo.get(l.cuenta);
    grupo.set(l.cuenta, {
      cuenta: l.cuenta,
      nombre: l.nombre ?? prev?.nombre ?? null,
      saldo: (prev?.saldo ?? 0) + Number(l.saldo),
    });
  }
  const cuentas = [...grupo.values()].sort(
    (a, b) => Math.abs(b.saldo) - Math.abs(a.saldo),
  );

  // Renglones del 110 mapeables (solo Patrimonio / Ingresos / Costos)
  const { data: renglones } = await supabase
    .from("form110_renglones")
    .select("numero, descripcion, seccion")
    .eq("ano_gravable", declaracion.ano_gravable)
    .in("seccion", SECCIONES_MAPEABLES as unknown as string[])
    .order("numero");

  // Overrides existentes
  const { data: overrides } = await supabase
    .from("puc_overrides")
    .select("puc, renglon_110")
    .eq("empresa_id", empresaId);

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/importar`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Importar Balance
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Homologar cuentas
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Estas cuentas auxiliares no tienen renglón asignado en el catálogo. Asigna
        cada una al renglón del 110 que corresponda. Las asignaciones quedan guardadas
        para esta empresa y se aplicarán automáticamente en futuras cargas.
      </p>

      {cuentas.length === 0 ? (
        <div className="mt-10 border border-dashed border-border p-10 text-center text-muted-foreground">
          No hay cuentas pendientes de homologar.
        </div>
      ) : (
        <div className="mt-8">
          <HomologarForm
            empresaId={empresaId}
            declId={declId}
            cuentas={cuentas}
            renglones={renglones ?? []}
            overridesIniciales={Object.fromEntries(
              (overrides ?? []).map((o) => [o.puc, o.renglon_110]),
            )}
          />
        </div>
      )}
    </div>
  );
}
