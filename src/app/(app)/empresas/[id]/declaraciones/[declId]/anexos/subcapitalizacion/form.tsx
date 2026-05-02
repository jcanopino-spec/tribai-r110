"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { saveSubAction, type SubState } from "./actions";

const initial: SubState = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n === 0) return "";
  return FMT.format(n);
}

function fmtInput(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SubForm({ declId, empresaId, declaracion }: any) {
  const action = saveSubAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);

  const [deuda, setDeuda] = useState(fmt(declaracion.sub_deuda_promedio));
  const [intereses, setIntereses] = useState(fmt(declaracion.sub_intereses));
  const [esVinculado, setEsVinculado] = useState<boolean>(
    Boolean(declaracion.sub_es_vinculado),
  );

  const patrimonioLiq = Number(declaracion.r41 ?? 0);
  const deudaNum = parseNum(deuda);
  const interesesNum = parseNum(intereses);

  // Art. 118-1 E.T.: límite es 2× patrimonio líquido del año anterior
  const limite = patrimonioLiq * 2;
  const exceso = Math.max(0, deudaNum - limite);
  const proporcionExceso = deudaNum > 0 ? exceso / deudaNum : 0;
  const interesesNoDeducibles = esVinculado ? interesesNum * proporcionExceso : 0;
  const interesesDeducibles = interesesNum - interesesNoDeducibles;

  return (
    <form action={formAction} className="space-y-8">
      <section>
        <h3 className="font-serif text-xl">Datos</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          La regla de subcapitalización (Art. 118-1 E.T., modificado por Ley
          2010 de 2019) aplica únicamente a deudas con vinculados económicos.
          El monto promedio total de las deudas que excedan 2 veces el
          patrimonio líquido del año anterior no genera intereses deducibles.
        </p>

        <label className="mt-5 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="sub_es_vinculado"
            checked={esVinculado}
            onChange={(e) => setEsVinculado(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">
            La deuda es con vinculados económicos (nacionales o del exterior)
          </span>
        </label>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Deuda promedio del año">
            <Input
              name="sub_deuda_promedio"
              inputMode="numeric"
              value={deuda}
              onChange={(e) => setDeuda(fmtInput(e.target.value))}
              disabled={!esVinculado}
            />
          </Field>
          <Field label="Intereses pagados sobre esa deuda">
            <Input
              name="sub_intereses"
              inputMode="numeric"
              value={intereses}
              onChange={(e) => setIntereses(fmtInput(e.target.value))}
              disabled={!esVinculado}
            />
          </Field>
        </div>

        <div className="mt-3 inline-block border border-border bg-muted/30 px-4 py-3 text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Patrimonio líquido AG anterior (R41)
          </p>
          <p className="mt-1 font-serif text-xl">{FMT.format(patrimonioLiq)}</p>
        </div>
      </section>

      {esVinculado ? (
        <section>
          <h3 className="font-serif text-xl">Cálculo</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Stat label="Límite (2× PL)" value={limite} />
            <Stat label="Exceso sobre límite" value={exceso} alert={exceso > 0} />
            <Stat label="% no deducible" value={proporcionExceso * 100} pct />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Stat label="Intereses deducibles" value={interesesDeducibles} />
            <Stat
              label="Intereses NO deducibles"
              value={interesesNoDeducibles}
              alert={interesesNoDeducibles > 0}
              emphasis
            />
          </div>
          {interesesNoDeducibles > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Reconoce {FMT.format(interesesNoDeducibles)} como gasto no
              deducible. Ajusta como ajuste crédito en la cuenta de intereses
              dentro del Balance Fiscal.
            </p>
          ) : null}
        </section>
      ) : (
        <section>
          <p className="text-sm text-muted-foreground">
            Sin deudas con vinculados: la regla de subcapitalización no aplica
            y todos los intereses de deudas con terceros son deducibles bajo
            las reglas generales de causalidad y necesidad.
          </p>
        </section>
      )}

      <div className="flex items-center justify-between">
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : <span />}
        {state.ok ? <p className="text-sm text-muted-foreground">Guardado.</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function Stat({
  label,
  value,
  alert,
  emphasis,
  pct,
}: {
  label: string;
  value: number;
  alert?: boolean;
  emphasis?: boolean;
  pct?: boolean;
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
          alert && !emphasis ? "text-destructive" : ""
        }`}
      >
        {pct ? `${value.toFixed(2)}%` : FMT.format(value)}
      </p>
    </div>
  );
}
