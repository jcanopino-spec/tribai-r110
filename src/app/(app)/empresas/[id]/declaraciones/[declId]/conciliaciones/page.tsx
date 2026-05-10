import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModuloHeader } from "@/components/modulo-header";

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
      "ano_gravable, estado, utilidad_contable, patrimonio_bruto_anterior, pasivos_anterior",
    )
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  // Conteos rápidos para mostrar progreso de cada conciliación
  const [
    { count: utilidadCount },
    { count: patrimonialCount },
    { count: f2516Count },
    { count: h1Count },
    { count: h4Count },
    { count: h5Count },
    { count: h6Count },
  ] = await Promise.all([
    supabase
      .from("conciliacion_partidas")
      .select("*", { count: "exact", head: true })
      .eq("declaracion_id", declId),
    supabase
      .from("conciliacion_patrimonial_partidas")
      .select("*", { count: "exact", head: true })
      .eq("declaracion_id", declId),
    supabase
      .from("formato_2516_ajustes")
      .select("*", { count: "exact", head: true })
      .eq("declaracion_id", declId),
    supabase
      .from("formato_2516_h1_caratula")
      .select("*", { count: "exact", head: true })
      .eq("declaracion_id", declId),
    supabase
      .from("formato_2516_h4_imp_diferido")
      .select("*", { count: "exact", head: true })
      .eq("declaracion_id", declId),
    supabase
      .from("formato_2516_h5_ingresos")
      .select("*", { count: "exact", head: true })
      .eq("declaracion_id", declId),
    supabase
      .from("formato_2516_h6_activos_fijos")
      .select("*", { count: "exact", head: true })
      .eq("declaracion_id", declId),
  ]);

  const plAnterior =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);

  return (
    <div className="max-w-5xl">
      <ModuloHeader
        titulo="Conciliaciones"
        moduloLabel="Módulo 10"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}`}
        volverLabel="Editor"
        contexto={`AG ${declaracion.ano_gravable} · estado ${declaracion.estado}`}
      />
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Dos puentes que la DIAN exige conciliar para que la declaración sea defendible
        ante una auditoría: la utilidad contable contra la renta líquida fiscal, y la
        variación patrimonial entre años. Tribai alimenta ambas automáticamente desde
        el Formulario 110 y los anexos; el usuario solo agrega partidas que NO se
        derivan (capitalizaciones, ajustes contables, valorizaciones).
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <ConciliacionCard
          href={`/empresas/${empresaId}/declaraciones/${declId}/conciliacion-fiscal`}
          titulo="Conciliación de utilidad"
          descripcion="Utilidad contable → Renta líquida fiscal. Explica diferencias permanentes y temporales que distorsionan la base gravable."
          puntoPartida="Utilidad contable"
          puntoFinal="Renta líquida fiscal"
          valorInicio={Number(declaracion.utilidad_contable ?? 0)}
          partidasManuales={utilidadCount ?? 0}
          baseLegal="Decreto Único Reglamentario · Art. 28-1 ET"
        />
        <ConciliacionCard
          href={`/empresas/${empresaId}/declaraciones/${declId}/conciliacion-patrimonial`}
          titulo="Conciliación patrimonial"
          descripcion="Verifica que el aumento del patrimonio se explique por las rentas declaradas. Si no, hay renta presumida."
          puntoPartida="Diferencia patrimonial entre años"
          puntoFinal="Renta por comparación patrimonial"
          valorInicio={plAnterior}
          partidasManuales={patrimonialCount ?? 0}
          baseLegal="Arts. 236 a 239 E.T."
        />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <ConciliacionCard
          href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
          titulo="Formato 2516"
          descripcion="Reporte oficial DIAN (Resolución 71/2019) que reconcilia el balance contable agregado (ESF + ERI) con los renglones del 110, fila por fila."
          puntoPartida="Balance contable agrupado"
          puntoFinal="Valores fiscales del 110"
          valorInicio={null}
          partidasManuales={f2516Count ?? 0}
          baseLegal="Resolución DIAN 71/2019"
        />
        <ConciliacionCard
          href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/impuesto-diferido`}
          titulo="Impuesto Diferido"
          descripcion="NIC 12 / Sección 29 NIIF Pymes. Activo y pasivo por ID derivado de las diferencias temporarias entre base contable y base fiscal."
          puntoPartida="Diferencias temporarias"
          puntoFinal="ID-A · ID-P · gasto neto"
          valorInicio={null}
          partidasManuales={0}
          baseLegal="NIC 12 / Sección 29 NIIF Pymes"
        />
      </div>

      <div className="mt-10">
        <h2 className="font-serif text-2xl tracking-[-0.01em]">
          Hojas oficiales del F2516
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Las 7 secciones que la Resolución DIAN 71/2019 exige reportar.
          Tribai pre-llena lo que se deriva del balance + F110, el contador
          captura lo específico de cada hoja.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <HojaPill
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/h1-caratula`}
            codigo="H1"
            titulo="Carátula"
            estado={h1Count && h1Count > 0 ? "completo" : "pendiente"}
          />
          <HojaPill
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/h2-esf`}
            codigo="H2"
            titulo="ESF"
            estado="auto"
          />
          <HojaPill
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/h3-eri`}
            codigo="H3"
            titulo="ERI"
            estado="auto"
          />
          <HojaPill
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/h4-impuesto-diferido`}
            codigo="H4"
            titulo="Imp Diferido"
            estado={h4Count && h4Count > 0 ? "completo" : "pendiente"}
          />
          <HojaPill
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/h5-ingresos-facturacion`}
            codigo="H5"
            titulo="Ingresos · FE"
            estado={h5Count && h5Count > 0 ? "completo" : "pendiente"}
          />
          <HojaPill
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/h6-activos-fijos`}
            codigo="H6"
            titulo="Activos Fijos"
            estado={h6Count && h6Count > 0 ? "completo" : "pendiente"}
          />
          <HojaPill
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/h7-resumen`}
            codigo="H7"
            titulo="Resumen"
            estado="auto"
          />
        </div>
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

function HojaPill({
  href,
  codigo,
  titulo,
  estado,
}: {
  href: string;
  codigo: string;
  titulo: string;
  estado: "completo" | "pendiente" | "auto";
}) {
  const colors =
    estado === "completo"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : estado === "auto"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-border";
  const label =
    estado === "completo" ? "✓ Capturado" : estado === "auto" ? "Auto" : "Pendiente";
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md border p-3 transition-colors hover:border-foreground ${colors}`}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded font-mono text-xs font-bold bg-foreground text-background">
        {codigo}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{titulo}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </p>
      </div>
    </Link>
  );
}

function ConciliacionCard({
  href,
  titulo,
  descripcion,
  puntoPartida,
  puntoFinal,
  valorInicio,
  partidasManuales,
  baseLegal,
}: {
  href: string;
  titulo: string;
  descripcion: string;
  puntoPartida: string;
  puntoFinal: string;
  valorInicio: number | null;
  partidasManuales: number;
  baseLegal: string;
}) {
  return (
    <Link
      href={href}
      className="group block border border-border p-5 transition-colors hover:border-foreground"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          {titulo}
        </h3>
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
          <p className="mt-1 font-mono tabular-nums">
            {valorInicio !== null ? `$${FMT.format(valorInicio)}` : "—"}
          </p>
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
        <span className="font-mono">{baseLegal}</span>
      </div>
    </Link>
  );
}
