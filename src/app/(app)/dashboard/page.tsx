import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: empresasCount }, { data: empresas }] = await Promise.all([
    supabase.from("empresas").select("*", { count: "exact", head: true }),
    supabase
      .from("empresas")
      .select("id, razon_social, nit, declaraciones(count)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">Bienvenido</p>
      <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
        Tus declaraciones
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Gestiona hasta 20 empresas y sus declaraciones de renta del año gravable 2025.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="border border-border p-5">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">Empresas</p>
          <p className="mt-2 font-serif text-3xl tracking-[-0.02em]">
            {empresasCount ?? 0} <span className="text-muted-foreground">/ 20</span>
          </p>
        </div>
      </div>

      <h2 className="mt-16 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">Empresas recientes</h2>
      {empresas && empresas.length > 0 ? (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {empresas.map((e) => (
            <li key={e.id}>
              <Link href={`/empresas/${e.id}`} className="flex items-center justify-between py-4 hover:bg-muted">
                <div>
                  <p className="font-medium">{e.razon_social}</p>
                  <p className="font-mono text-xs text-muted-foreground">NIT {e.nit}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {(e.declaraciones?.[0]?.count ?? 0)} declaraciones
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Aún no has creado empresas.</p>
          <Link
            href="/empresas/nueva"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
          >
            Crear primera empresa
          </Link>
        </div>
      )}
    </div>
  );
}
