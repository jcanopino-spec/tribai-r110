import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InteresForm } from "./form";
import { InteresList } from "./list";

export const metadata = { title: "Anexo 14 · Interés Presuntivo" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function InteresesPage({
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

  // Tasa de interés presuntivo del año
  const { data: tasaRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable)
    .eq("codigo", "tasa_interes_presuntivo")
    .maybeSingle();
  const tasa = tasaRow ? Number(tasaRow.valor) : 0;

  const { data: items } = await supabase
    .from("anexo_intereses_presuntivos")
    .select("id, socio, cuenta, saldo_promedio, dias, interes_registrado, observacion, created_at")
    .eq("declaracion_id", declId)
    .order("created_at");

  const todos = items ?? [];

  // Calcular interés presunto y diferencia por socio
  const calculados = todos.map((p) => {
    const interesPresunto = Number(p.saldo_promedio) * tasa * (p.dias / 360);
    const diferencia = Math.max(0, interesPresunto - Number(p.interes_registrado));
    return { ...p, interesPresunto, diferencia };
  });

  const totalSaldo = calculados.reduce((s, c) => s + Number(c.saldo_promedio), 0);
  const totalPresunto = calculados.reduce((s, c) => s + c.interesPresunto, 0);
  const totalRegistrado = calculados.reduce((s, c) => s + Number(c.interes_registrado), 0);
  const totalDiferencia = calculados.reduce((s, c) => s + c.diferencia, 0);

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexo 14 · Interés Presuntivo
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Préstamos a socios/accionistas (Art. 35 E.T.). El interés presuntivo es
        el saldo promedio × tasa de interés presuntivo del año × días/360. Si el
        interés cobrado es menor, la diferencia debe declararse como ingreso
        financiero adicional (renglón 48).
      </p>

      <div className="mt-6 inline-block border border-border bg-muted/30 px-4 py-3 text-sm">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          Tasa interés presuntivo AG {declaracion.ano_gravable}
        </p>
        <p className="mt-1 font-serif text-xl">{(tasa * 100).toFixed(2)}%</p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Stat label="Saldo total" value={totalSaldo} />
        <Stat label="Interés presunto" value={totalPresunto} />
        <Stat label="Interés registrado" value={totalRegistrado} muted />
        <Stat
          label="Diferencia (R48 sugerido)"
          value={totalDiferencia}
          alert={totalDiferencia > 0}
          emphasis
        />
      </div>

      {totalDiferencia > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Reporta esta diferencia ({FMT.format(totalDiferencia)}) en tu balance
          fiscal como mayor valor de ingresos financieros (cuenta 4210) para que
          quede reflejada en el renglón 48.
        </p>
      ) : null}

      <div className="mt-12">
        <InteresForm declId={declId} empresaId={empresaId} />
      </div>

      <div className="mt-12">
        <InteresList items={calculados} declId={declId} empresaId={empresaId} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
  muted,
  emphasis,
}: {
  label: string;
  value: number;
  alert?: boolean;
  muted?: boolean;
  emphasis?: boolean;
}) {
  const cls = emphasis
    ? "border-foreground bg-foreground text-background"
    : alert
      ? "border-destructive/40 bg-destructive/5"
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
        className={`mt-2 font-serif text-2xl tracking-[-0.02em] ${muted ? "text-muted-foreground" : ""}`}
      >
        {FMT.format(value)}
      </p>
    </div>
  );
}
