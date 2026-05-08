import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RetencionForm } from "./form";
import { RetencionList } from "./list";

export const metadata = { title: "Retenciones y Autorretenciones" };

export default async function RetencionesPage({
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

  const { data: items } = await supabase
    .from("anexo_retenciones")
    .select("id, tipo, concepto, agente, nit, base, retenido, created_at")
    .eq("declaracion_id", declId)
    .order("tipo")
    .order("created_at");

  const todas = items ?? [];
  const retenciones = todas.filter((r) => r.tipo === "retencion");
  const autorretenciones = todas.filter((r) => r.tipo === "autorretencion");
  const totalRetenciones = retenciones.reduce((s, r) => s + Number(r.retenido), 0);
  const totalAutorretenciones = autorretenciones.reduce((s, r) => s + Number(r.retenido), 0);

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Retenciones y Autorretenciones
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Suma de autorretenciones → renglón 105. Suma de retenciones →
            renglón 106. Total (105 + 106) → renglón 107.
          </p>
        </div>
        {todas.length > 0 ? (
          <a
            href={`/api/anexos/retenciones/export?decl=${declId}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-secondary px-5 text-sm hover:bg-muted"
            title="Descarga el listado en .xlsx para validar contra información exógena u otras fuentes"
          >
            ⬇️ Exportar a Excel
          </a>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Total retenciones (R106)" value={totalRetenciones} />
        <Stat label="Total autorretenciones (R105)" value={totalAutorretenciones} />
        <Stat
          label="Total R107"
          value={totalRetenciones + totalAutorretenciones}
          emphasis
        />
      </div>

      <div className="mt-12">
        <RetencionForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <RetencionList
          retenciones={retenciones}
          autorretenciones={autorretenciones}
          declId={declId}
          empresaId={empresaId}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className={`border p-5 ${emphasis ? "border-foreground bg-foreground text-background" : "border-border"}`}>
      <p className={`font-mono text-xs uppercase tracking-[0.05em] ${emphasis ? "text-background/70" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl tracking-[-0.02em]">
        {new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)}
      </p>
    </div>
  );
}
