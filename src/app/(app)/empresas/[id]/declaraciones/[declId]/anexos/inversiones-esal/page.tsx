import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InversionEsalForm } from "./form";
import { InversionEsalList } from "./list";
import type { InversionEsalItem } from "./consts";

export const metadata = { title: "Inversiones ESAL" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function InversionesEsalPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, empresa_id")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("razon_social, regimen_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  const esEsal = String(empresa.regimen_codigo ?? "").padStart(2, "0") === "08";

  // Defensivo: si la migración 027 no está aplicada, query falla con
  // PGRST205 → tratamos como tabla vacía.
  const res = await supabase
    .from("anexo_inversiones_esal")
    .select(
      "id, tipo, fecha, ano_origen, concepto, categoria, valor, observacion",
    )
    .eq("declaracion_id", declId)
    .order("tipo")
    .order("fecha", { nullsFirst: false });
  const tablaExiste = !res.error;
  const items: InversionEsalItem[] = (res.data ?? []).map((r) => ({
    ...r,
    tipo: r.tipo as InversionEsalItem["tipo"],
    valor: Number(r.valor),
  }));

  const efectuadas = items.filter((i) => i.tipo === "efectuada");
  const liquidadas = items.filter((i) => i.tipo === "liquidada");
  const totalEfectuadas = efectuadas.reduce((s, i) => s + i.valor, 0);
  const totalLiquidadas = liquidadas.reduce((s, i) => s + i.valor, 0);

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
            Inversiones ESAL
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Detalle de las inversiones del Régimen Tributario Especial (Art.
            356-359 E.T.). Las{" "}
            <span className="font-medium">efectuadas en el año</span> alimentan
            R68 (deducción) y las{" "}
            <span className="font-medium">liquidadas de años anteriores</span>{" "}
            alimentan R69 (recuperación). Solo aplica para empresas régimen 08.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
            {empresa.razon_social}
          </p>
          <p className="font-mono text-xs">
            Régimen{" "}
            <span className="font-medium">
              {empresa.regimen_codigo ?? "sin asignar"}
            </span>
          </p>
        </div>
      </div>

      {!esEsal ? (
        <div className="mt-6 border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          ⓘ Esta empresa NO está configurada como régimen ESAL (08). El
          Anexo aún se puede usar pero los renglones R68/R69 normalmente
          no aplican fuera del régimen tributario especial. Verifica el
          régimen de la empresa antes de capturar inversiones.
        </div>
      ) : null}

      {!tablaExiste ? (
        <div className="mt-6 border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          La tabla <span className="font-mono">anexo_inversiones_esal</span> no
          existe. Aplica la migración 027 en el SQL Editor del dashboard de
          Supabase para habilitar la persistencia.
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <Stat label="R68 · Efectuadas en el año" value={totalEfectuadas} />
        <Stat
          label="R69 · Liquidadas de años anteriores"
          value={totalLiquidadas}
        />
      </div>

      <div className="mt-12">
        <InversionEsalForm
          declId={declId}
          empresaId={empresaId}
          anoActual={declaracion.ano_gravable}
        />
      </div>

      <div className="mt-12">
        <InversionEsalList
          items={items}
          declId={declId}
          empresaId={empresaId}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border p-4">
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl tabular-nums">{FMT.format(value)}</p>
    </div>
  );
}
