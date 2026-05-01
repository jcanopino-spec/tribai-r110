import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SECCIONES_MAPEABLES } from "@/lib/forms/form110-2025";
import { RENGLONES_COMPUTADOS } from "@/lib/forms/form110-compute";
import { BalanceView } from "./balance-view";

export const metadata = { title: "Balance cargado" };

export default async function BalancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; declId: string }>;
  searchParams?: Promise<{ filter?: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const sp = (await searchParams) ?? {};
  const filter = (sp.filter ?? "todas") as "todas" | "mapeadas" | "pendientes";

  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, empresa:empresas(id, razon_social)")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: balance } = await supabase
    .from("balance_pruebas")
    .select("id, filename, uploaded_at")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!balance) {
    return (
      <div className="max-w-2xl">
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}`}
          className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
        >
          ← Volver al editor
        </Link>
        <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
          Balance cargado
        </h1>
        <div className="mt-8 border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Aún no has cargado un balance.</p>
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/importar`}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
          >
            Cargar balance →
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: lineas }, { data: renglones }] = await Promise.all([
    supabase
      .from("balance_prueba_lineas")
      .select("id, cuenta, nombre, saldo, renglon_110")
      .eq("balance_id", balance.id)
      .order("cuenta"),
    supabase
      .from("form110_renglones")
      .select("numero, descripcion, seccion")
      .eq("ano_gravable", declaracion.ano_gravable)
      .in("seccion", SECCIONES_MAPEABLES as unknown as string[])
      .order("numero"),
  ]);

  const todas = lineas ?? [];
  const auxiliares = todas.filter((l) => l.cuenta.length >= 6);
  const mapeadas = auxiliares.filter((l) => l.renglon_110 != null);
  const pendientes = auxiliares.filter((l) => l.renglon_110 == null);

  // Total agregado por renglón (solo auxiliares para evitar duplicar con mayores)
  const totalesPorRenglon = new Map<number, { total: number; descripcion: string; seccion: string; conteo: number }>();
  for (const l of mapeadas) {
    const r = renglones?.find((x) => x.numero === l.renglon_110);
    if (!r) continue;
    const prev = totalesPorRenglon.get(l.renglon_110!) ?? {
      total: 0,
      descripcion: r.descripcion,
      seccion: r.seccion,
      conteo: 0,
    };
    prev.total += Number(l.saldo);
    prev.conteo += 1;
    totalesPorRenglon.set(l.renglon_110!, prev);
  }

  const seleccionadas =
    filter === "mapeadas" ? mapeadas : filter === "pendientes" ? pendientes : todas;

  return (
    <BalanceView
      empresaId={empresaId}
      declId={declId}
      balance={{ filename: balance.filename, uploaded_at: balance.uploaded_at }}
      filter={filter}
      conteos={{ total: todas.length, mapeadas: mapeadas.length, pendientes: pendientes.length }}
      lineas={seleccionadas.map((l) => ({
        cuenta: l.cuenta,
        nombre: l.nombre,
        saldo: Number(l.saldo),
        renglon_110: l.renglon_110,
      }))}
      renglones={(renglones ?? []).filter((r) => !RENGLONES_COMPUTADOS.has(r.numero))}
      totalesPorRenglon={[...totalesPorRenglon.entries()]
        .map(([numero, data]) => ({ numero, ...data }))
        .sort((a, b) => a.numero - b.numero)}
    />
  );
}
