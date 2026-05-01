import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDeclaracionAction } from "../actions";
import { DEFAULT_YEAR, SUPPORTED_YEARS } from "@/lib/years";

export const metadata = { title: "Empresa" };

export default async function EmpresaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: empresa } = await supabase
    .from("empresas")
    .select(
      "id, nit, dv, razon_social, ciiu_codigo, direccion_seccional_codigo, regimen_codigo, created_at",
    )
    .eq("id", id)
    .single();

  if (!empresa) notFound();

  const { data: declaraciones } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, formato, estado, updated_at")
    .eq("empresa_id", empresa.id)
    .order("ano_gravable", { ascending: false });

  const createForYear = createDeclaracionAction.bind(null, empresa.id);

  return (
    <div>
      <Link
        href="/empresas"
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Empresas
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">{empresa.razon_social}</h1>
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        NIT {empresa.nit}{empresa.dv ? `-${empresa.dv}` : ""} · CIIU {empresa.ciiu_codigo ?? "—"} · DIAN{" "}
        {empresa.direccion_seccional_codigo ?? "—"} · Régimen {empresa.regimen_codigo ?? "—"}
      </p>

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">Declaraciones de renta</h2>
        </div>

        {declaraciones && declaraciones.length > 0 ? (
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {declaraciones.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/empresas/${empresa.id}/declaraciones/${d.id}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4 hover:bg-muted"
                >
                  <p className="font-mono text-lg">{d.ano_gravable}</p>
                  <p>
                    Formulario {d.formato}
                    <span className="ml-3 inline-block rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                      {d.estado}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    actualizada {new Date(d.updated_at).toLocaleDateString("es-CO")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-muted-foreground">Sin declaraciones todavía.</p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {SUPPORTED_YEARS.map((y) => {
            const exists = declaraciones?.some((d) => d.ano_gravable === y);
            return (
              <form key={y} action={createForYear.bind(null, y)}>
                <button
                  type="submit"
                  className={`inline-flex h-10 items-center justify-center rounded-full px-5 text-sm transition-colors ${
                    y === DEFAULT_YEAR
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border-secondary hover:bg-muted"
                  }`}
                >
                  {exists ? "Abrir" : "Nueva"} declaración AG {y}
                </button>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
