import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Conciliaciones" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function ConciliacionesHubPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select(
      "ano_gravable, estado, cf_utilidad_contable, patrimonio_bruto_anterior, pasivos_anterior",
    )
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  // Conteos rápidos para mostrar progreso de cada conciliación
  const [{ count: utilidadCount }, { count: patrimonialCount }] = await Promise.all([
    supabase
      .from("conciliacion_partidas")
      .select("*", { count: "exact", head: true })
      .eq("declaracion_id", declId),
    supabase
      .from("conciliacion_patrimonial_partidas")
      .select("*", { count: "exact", head: true })
      .eq("declaracion_id", declId),
  ]);

  const plAnterior =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Conciliaciones
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Dos puentes que la DIAN exige conciliar para que la declaración sea defendible
        ante una auditoría: la utilidad contable contra la renta líquida fiscal, y la
        variación patrimonial entre años. Tribai alimenta ambas automáticamente desde
        el Formulario 110 y los anexos; el usuario solo agrega partidas que NO se
        derivan (capitalizaciones, ajustes contables, valorizaciones).
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <ConciliacionCard
          href={`/empresas/${empresaId}/declaraciones/${declId}/conciliacion-fiscal`}
          numero="A"
          titulo="Conciliación de utilidad"
          descripcion="Utilidad contable → Renta líquida fiscal. Explica diferencias permanentes y temporales."
          puntoPartida="Utilidad contable"
          puntoFinal="Renta líquida fiscal (R72/R75/R79)"
          valorInicio={Number(declaracion.cf_utilidad_contable ?? 0)}
          partidasManuales={utilidadCount ?? 0}
          referenciaXlsm="Anexo 17 / Hoja H7"
        />
        <ConciliacionCard
          href={`/empresas/${empresaId}/declaraciones/${declId}/conciliacion-patrimonial`}
          numero="B"
          titulo="Conciliación patrimonial"
          descripcion="Patrimonio líquido AG anterior → Patrimonio líquido AG actual. Justifica la variación."
          puntoPartida="PL fiscal AG anterior"
          puntoFinal="PL fiscal AG actual (R46)"
          valorInicio={plAnterior}
          partidasManuales={patrimonialCount ?? 0}
          referenciaXlsm="Anexo 16 / Anexo 24"
        />
      </div>

      <div className="mt-12 border border-dashed border-border p-5">
        <h3 className="font-serif text-lg">¿Por qué dos conciliaciones?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          La <span className="font-medium text-foreground">conciliación de utilidad</span>{" "}
          es horizontal: explica por qué la utilidad contable del año (resultado de
          PyG) no coincide con la renta líquida fiscal (lo que tributará). Las
          diferencias permanentes (multas, gastos sin soporte) no se revierten;
          las temporales (depreciación, deterioro) sí, y generan impuesto diferido.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          La <span className="font-medium text-foreground">conciliación patrimonial</span>{" "}
          es vertical: explica por qué el patrimonio líquido fiscal cambió entre el
          31-dic anterior y el 31-dic actual. La fórmula esencial es: PL anterior +
          utilidad fiscal − impuesto − dividendos distribuidos ± otros = PL actual.
          Si no cuadra, hay un riesgo de detrimento patrimonial sin justificar.
        </p>
      </div>

      <div className="mt-6 text-xs text-muted-foreground">
        <p>
          Estado de la declaración:{" "}
          <span className="font-mono">{declaracion.estado}</span> · AG{" "}
          <span className="font-mono">{declaracion.ano_gravable}</span>
        </p>
      </div>
    </div>
  );
}

function ConciliacionCard({
  href,
  numero,
  titulo,
  descripcion,
  puntoPartida,
  puntoFinal,
  valorInicio,
  partidasManuales,
  referenciaXlsm,
}: {
  href: string;
  numero: string;
  titulo: string;
  descripcion: string;
  puntoPartida: string;
  puntoFinal: string;
  valorInicio: number;
  partidasManuales: number;
  referenciaXlsm: string;
}) {
  return (
    <Link
      href={href}
      className="group block border border-border p-5 transition-colors hover:border-foreground"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Conciliación {numero}
          </p>
          <h3 className="mt-2 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
            {titulo}
          </h3>
        </div>
        <span className="font-mono text-xs text-muted-foreground transition-colors group-hover:text-foreground">
          →
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{descripcion}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <div className="border border-border p-2">
          <p className="font-mono uppercase tracking-[0.05em] text-muted-foreground">
            Punto de partida
          </p>
          <p className="mt-1">{puntoPartida}</p>
          <p className="mt-1 font-mono tabular-nums">${FMT.format(valorInicio)}</p>
        </div>
        <div className="border border-border p-2">
          <p className="font-mono uppercase tracking-[0.05em] text-muted-foreground">
            Punto final
          </p>
          <p className="mt-1">{puntoFinal}</p>
          <p className="mt-1 font-mono uppercase tracking-[0.05em] text-muted-foreground">
            Auto
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Partidas manuales:{" "}
          <span className="font-mono text-foreground">{partidasManuales}</span>
        </span>
        <span className="font-mono">{referenciaXlsm}</span>
      </div>
    </Link>
  );
}
