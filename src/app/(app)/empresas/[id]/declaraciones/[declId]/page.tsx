import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeclaracionEditor } from "./editor";

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

  return (
    <div>
      <Link
        href={`/empresas/${empresaId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← {declaracion.empresa?.razon_social}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            AG {declaracion.ano_gravable} · Formulario {declaracion.formato} · {declaracion.estado}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Declaración de renta
          </h1>
        </div>
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}/importar`}
          className="inline-flex h-10 items-center justify-center rounded-full border border-border-secondary px-5 text-sm hover:bg-muted"
        >
          Importar Balance de Prueba
        </Link>
      </div>

      <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
        Puedes ingresar los valores manualmente en cada renglón, o importar un Balance de
        Prueba para que se carguen automáticamente. Los valores se guardan como borrador
        hasta que finalices la declaración.
      </p>

      <div className="mt-12">
        <DeclaracionEditor
          declId={declId}
          empresaId={empresaId}
          renglones={renglones ?? []}
          valoresIniciales={(valores ?? []).map((v) => ({
            numero: v.numero,
            valor: Number(v.valor),
          }))}
        />
      </div>
    </div>
  );
}
