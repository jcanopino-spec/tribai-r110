import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Editor declaración" };

export default async function DeclaracionEditorPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, formato, estado, empresa:empresas(id, razon_social, nit)")
    .eq("id", declId)
    .single();

  if (!declaracion) notFound();

  const [{ data: renglones }, { data: valores }] = await Promise.all([
    supabase
      .from("form110_renglones")
      .select("numero, descripcion, seccion")
      .eq("ano_gravable", declaracion.ano_gravable)
      .order("numero"),
    supabase
      .from("form110_valores")
      .select("numero, valor")
      .eq("declaracion_id", declId),
  ]);

  const valorPorNumero = new Map<number, number>(
    (valores ?? []).map((v) => [v.numero, Number(v.valor)]),
  );

  const renglonesPorSeccion = new Map<string, typeof renglones>();
  for (const r of renglones ?? []) {
    const arr = renglonesPorSeccion.get(r.seccion) ?? [];
    arr.push(r);
    renglonesPorSeccion.set(r.seccion, arr);
  }

  return (
    <div>
      <Link
        href={`/empresas/${empresaId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← {declaracion.empresa?.razon_social}
      </Link>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            AG {declaracion.ano_gravable} · Formulario {declaracion.formato} · {declaracion.estado}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Declaración de renta
          </h1>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex h-10 items-center justify-center rounded-full border border-border-secondary px-5 text-sm opacity-50"
          title="Importador llega en Fase 4"
        >
          Importar Balance de Prueba
        </button>
      </div>

      <div className="mt-12 space-y-12">
        {Array.from(renglonesPorSeccion.entries()).map(([seccion, items]) => (
          <section key={seccion}>
            <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">{seccion}</h2>
            <div className="mt-4 overflow-hidden border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                      N°
                    </th>
                    <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                      Descripción
                    </th>
                    <th className="px-4 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items?.map((r) => (
                    <tr key={r.numero} className="border-t border-border">
                      <td className="px-4 py-2 align-top font-mono">{r.numero}</td>
                      <td className="px-4 py-2 align-top">{r.descripcion}</td>
                      <td className="px-4 py-2 text-right align-top font-mono">
                        {(valorPorNumero.get(r.numero) ?? 0).toLocaleString("es-CO")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
