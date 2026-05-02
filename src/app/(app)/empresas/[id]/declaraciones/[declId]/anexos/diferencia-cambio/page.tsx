import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DifCambioForm } from "./form";
import { DifCambioList } from "./list";

export const metadata = { title: "Anexo 22 · Diferencia en Cambio" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function DifCambioPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  // TRM final del año (de parametros_anuales)
  const { data: trmRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable)
    .eq("codigo", "trm_promedio")
    .maybeSingle();
  const trmFinal = trmRow ? Number(trmRow.valor) : 0;

  const { data: items } = await supabase
    .from("anexo_diferencia_cambio")
    .select("id, tipo, cuenta, nit, tercero, fecha_transaccion, valor_usd, trm_inicial, observacion, created_at")
    .eq("declaracion_id", declId)
    .order("tipo")
    .order("created_at");

  const todos = items ?? [];

  // Calcular diferencia por línea
  const calculados = todos.map((p) => {
    const valorInicial = Number(p.valor_usd) * Number(p.trm_inicial);
    const valorFinal = Number(p.valor_usd) * trmFinal;
    // Activos: si TRM sube, dif positiva (ingreso). Pasivos: signo invertido (deuda crece = gasto)
    const difBruta = valorFinal - valorInicial;
    const diferencia = p.tipo === "pasivo" ? -difBruta : difBruta;
    return { ...p, valorInicial, valorFinal, diferencia };
  });

  const activos = calculados.filter((c) => c.tipo === "activo");
  const pasivos = calculados.filter((c) => c.tipo === "pasivo");
  const totalActivos = activos.reduce((s, c) => s + c.diferencia, 0);
  const totalPasivos = pasivos.reduce((s, c) => s + c.diferencia, 0);
  const totalNeto = totalActivos + totalPasivos;

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 22 · Diferencia en Cambio
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Cuentas con saldo en moneda extranjera (USD). La diferencia en cambio
        no realizada entre TRM inicial (fecha de transacción) y TRM final del
        año afecta ingresos financieros (R48) o gastos financieros (R65).
      </p>

      <div className="mt-6 inline-block border border-border bg-muted/30 px-4 py-3 text-sm">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          TRM final AG {declaracion.ano_gravable}
        </p>
        <p className="mt-1 font-serif text-xl">
          $ {USD.format(trmFinal)} <span className="text-xs text-muted-foreground">/ USD</span>
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Diferencia activos" value={totalActivos} />
        <Stat label="Diferencia pasivos" value={totalPasivos} />
        <Stat
          label="Diferencia neta"
          value={totalNeto}
          emphasis
          alert={totalNeto !== 0}
        />
      </div>

      {totalNeto !== 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {totalNeto > 0
            ? `Reconoce ${FMT.format(totalNeto)} como ingreso por diferencia en cambio (cuenta 4210, alimenta R48).`
            : `Reconoce ${FMT.format(Math.abs(totalNeto))} como gasto por diferencia en cambio (cuenta 5305, alimenta R65).`}
        </p>
      ) : null}

      <div className="mt-12">
        <DifCambioForm declId={declId} empresaId={empresaId} trmFinal={trmFinal} />
      </div>

      <div className="mt-12">
        <DifCambioList items={calculados} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
  emphasis,
}: {
  label: string;
  value: number;
  alert?: boolean;
  emphasis?: boolean;
}) {
  const cls = emphasis
    ? "border-foreground bg-foreground text-background"
    : "border-border";
  return (
    <div className={`border p-5 ${cls}`}>
      <p
        className={`font-mono text-xs uppercase tracking-[0.05em] ${
          emphasis ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 font-serif text-2xl tracking-[-0.02em] ${
          alert && !emphasis ? (value > 0 ? "text-success" : "text-destructive") : ""
        }`}
      >
        {FMT.format(value)}
      </p>
    </div>
  );
}
