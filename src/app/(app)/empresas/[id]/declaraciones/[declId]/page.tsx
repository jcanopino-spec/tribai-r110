import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeclaracionEditor } from "./editor";
import { ModePicker } from "./mode-picker";
import { clearModoCargaAction } from "./actions";

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
    .select(
      "id, ano_gravable, formato, estado, modo_carga, empresa:empresas(id, razon_social, nit)",
    )
    .eq("id", declId)
    .single();

  if (!declaracion) notFound();

  const cambiarModo = clearModoCargaAction.bind(null, declId, empresaId);

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
            AG {declaracion.ano_gravable} · Formulario {declaracion.formato} ·{" "}
            {declaracion.estado}
            {declaracion.modo_carga ? (
              <>
                {" "}
                · modo{" "}
                <span className="text-foreground">
                  {declaracion.modo_carga === "manual" ? "manual" : "balance de prueba"}
                </span>
              </>
            ) : null}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Declaración de renta
          </h1>
        </div>
        {declaracion.modo_carga ? (
          <form action={cambiarModo}>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
            >
              Cambiar modo de carga
            </button>
          </form>
        ) : null}
      </div>

      {declaracion.modo_carga === null ? (
        <>
          <p className="mt-6 max-w-3xl text-muted-foreground">
            Cómo quieres cargar la información de esta declaración? Puedes cambiar la
            elección después si lo necesitas.
          </p>
          <ModePicker declId={declId} empresaId={empresaId} />
        </>
      ) : declaracion.modo_carga === "manual" ? (
        <ManualMode declId={declId} empresaId={empresaId} ano={declaracion.ano_gravable} />
      ) : (
        <BalanceModeRedirect empresaId={empresaId} declId={declId} />
      )}
    </div>
  );
}

async function ManualMode({
  declId,
  empresaId,
  ano,
}: {
  declId: string;
  empresaId: string;
  ano: number;
}) {
  const supabase = await createClient();
  const [{ data: renglones }, { data: valores }] = await Promise.all([
    supabase
      .from("form110_renglones")
      .select("numero, descripcion, seccion")
      .eq("ano_gravable", ano)
      .order("numero"),
    supabase
      .from("form110_valores")
      .select("numero, valor")
      .eq("declaracion_id", declId),
  ]);

  return (
    <div className="mt-12">
      <p className="text-sm text-muted-foreground">
        Digita los valores en cada renglón. Los miles se formatean automáticamente. Recuerda
        guardar como borrador antes de salir.
      </p>
      <div className="mt-8">
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

function BalanceModeRedirect({ empresaId, declId }: { empresaId: string; declId: string }) {
  return (
    <div className="mt-12 max-w-2xl border border-border p-8">
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        Modo balance de prueba
      </p>
      <h3 className="mt-3 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
        Sube tu archivo
      </h3>
      <p className="mt-3 text-muted-foreground">
        El upload, parseo y mapeo PUC → 110 llegan en Fase 4. Mientras tanto, puedes ir a la
        pantalla de importación para revisar la estructura esperada del archivo.
      </p>
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/importar`}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
      >
        Ir a importar →
      </Link>
    </div>
  );
}
