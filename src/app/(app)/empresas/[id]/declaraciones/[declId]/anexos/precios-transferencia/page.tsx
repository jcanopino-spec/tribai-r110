import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  evaluarObligacionPT,
  METODOS_PT,
} from "@/engine/precios-transferencia";

export const metadata = { title: "Precios de Transferencia" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function PreciosTransferenciaPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, empresa_id, patrimonio_bruto_anterior")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("razon_social")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  // UVT anterior (para umbral de patrimonio) y actual (para umbral de ingresos)
  const [{ data: uvtAntRow }, { data: uvtActRow }, { data: form110ValuesRows }] =
    await Promise.all([
      supabase
        .from("parametros_anuales")
        .select("valor")
        .eq("ano_gravable", declaracion.ano_gravable - 1)
        .eq("codigo", "uvt")
        .maybeSingle(),
      supabase
        .from("parametros_anuales")
        .select("valor")
        .eq("ano_gravable", declaracion.ano_gravable)
        .eq("codigo", "uvt")
        .maybeSingle(),
      supabase
        .from("form110_valores")
        .select("valor")
        .eq("declaracion_id", declId)
        .eq("numero", 58),
    ]);

  const uvtAnterior = uvtAntRow ? Number(uvtAntRow.valor) : 47_065;
  const uvtActual = uvtActRow ? Number(uvtActRow.valor) : 49_799;
  const patrimonioBrutoAnterior = Number(declaracion.patrimonio_bruto_anterior ?? 0);
  // R58 directo (sin compute completo, suficiente para chequeo de umbrales)
  const r58Row = form110ValuesRows?.[0];
  const ingresosBrutosActual = r58Row ? Math.abs(Number(r58Row.valor)) : 0;

  const obligacion = evaluarObligacionPT({
    patrimonioBrutoAnterior,
    ingresosBrutosActual,
    uvtAnterior,
    uvtActual,
  });

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Precios de Transferencia
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Evaluación automática de obligaciones de Precios de Transferencia
            según Arts. 260-1 a 260-11 E.T. La obligación de presentar
            Declaración Informativa (Formato 1125) y Documentación
            Comprobatoria depende de los umbrales de patrimonio bruto AG
            anterior y/o ingresos brutos AG actual.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
            {empresa.razon_social}
          </p>
          <p className="font-mono text-xs">AG {declaracion.ano_gravable}</p>
        </div>
      </div>

      {obligacion.obligado ? (
        <div className="mt-6 border-2 border-destructive/60 bg-destructive/5 p-5">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-destructive">
            ⚠ Empresa OBLIGADA a Régimen de Precios de Transferencia
          </p>
          <p className="mt-2 text-sm">{obligacion.causa}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Debes presentar la Declaración Informativa Individual (Formato
            1125) y preparar la Documentación Comprobatoria de las operaciones
            con vinculados del exterior y/o paraísos fiscales.
          </p>
        </div>
      ) : (
        <div className="mt-6 border border-success/40 bg-success/5 p-5">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-success">
            ✓ Empresa NO obligada a Régimen de Precios de Transferencia
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Patrimonio e ingresos por debajo de los umbrales del Art. 260-9
            E.T. Si cambian las cifras durante el año, vuelve a evaluar.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <Stat
          label="Patrimonio bruto AG anterior"
          actual={obligacion.patrimonioActual}
          umbral={obligacion.patrimonioUmbral}
          umbralLabel="100.000 UVT"
          supera={obligacion.patrimonioSupera}
        />
        <Stat
          label="Ingresos brutos AG actual"
          actual={obligacion.ingresosActual}
          umbral={obligacion.ingresosUmbral}
          umbralLabel="61.000 UVT"
          supera={obligacion.ingresosSupera}
        />
      </div>

      <section className="mt-12">
        <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Métodos PT permitidos · Art. 260-3 E.T.
        </h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {METODOS_PT.map((m) => (
            <div key={m.codigo} className="border border-border p-3 text-sm">
              <p className="font-mono text-xs text-muted-foreground">
                {m.codigo}
              </p>
              <p className="mt-1">{m.nombre}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Vinculados y paraísos fiscales</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-foreground">Vinculados del exterior</span>{" "}
            (Art. 260-1) · empresas matrices, filiales, subordinadas con
            participación &gt; 50%, dirección común, etc.
          </li>
          <li>
            <span className="font-medium text-foreground">Paraísos fiscales</span> ·
            jurisdicciones de baja o nula imposición listadas por el MinHacienda
            (Decreto 1966/2014 actualizado). Las operaciones se someten a PT
            sin importar el monto del vinculado.
          </li>
          <li>
            <span className="font-medium text-foreground">Sanciones</span> · Arts.
            260-10 y 260-11 E.T. Multa por extemporaneidad de la informativa,
            por inconsistencias o por omisión de operaciones.
          </li>
          <li>
            Esta vista es <span className="font-medium">informativa</span>: no
            sustituye la documentación comprobatoria ni la informativa que
            presenta firma especializada.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  actual,
  umbral,
  umbralLabel,
  supera,
}: {
  label: string;
  actual: number;
  umbral: number;
  umbralLabel: string;
  supera: boolean;
}) {
  const cls = supera
    ? "border-destructive/40 bg-destructive/5"
    : "border-border";
  return (
    <div className={`border p-4 ${cls}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl tabular-nums">{FMT.format(actual)}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Umbral · {umbralLabel}{" "}
        <span className="font-mono">({FMT.format(umbral)})</span>
      </p>
      <p
        className={`mt-1 font-mono text-xs ${supera ? "text-destructive" : "text-success"}`}
      >
        {supera ? "✕ Supera el umbral" : "✓ Por debajo del umbral"}
      </p>
    </div>
  );
}
