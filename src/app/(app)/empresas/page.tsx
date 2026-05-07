import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Empresas" };

export default async function EmpresasPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, razon_social, nit, dv, ciiu_codigo, regimen_codigo, declaraciones(count)")
    .order("razon_social");

  const count = empresas?.length ?? 0;

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">{count} / 20</p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">Empresas</h1>
        </div>
        {count < 20 ? (
          <Link
            href="/empresas/nueva"
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
          >
            + Nueva empresa
          </Link>
        ) : null}
      </div>

      {count === 0 ? (
        <div className="mt-10 border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Aún no has creado empresas.</p>
          <Link
            href="/empresas/nueva"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
          >
            Crear primera empresa
          </Link>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-border border-y border-border">
          {empresas!.map((e) => (
            <li key={e.id}>
              <Link href={`/empresas/${e.id}`} className="grid grid-cols-[1fr_auto] gap-4 py-4 hover:bg-muted">
                <div>
                  <p className="font-medium">{e.razon_social}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    NIT {e.nit}{e.dv ? `-${e.dv}` : ""} · CIIU {e.ciiu_codigo ?? "—"} · Régimen {e.regimen_codigo ?? "—"}
                  </p>
                </div>
                <p className="self-center text-sm text-muted-foreground">
                  {(e.declaraciones?.[0]?.count ?? 0)} declaraciones
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
