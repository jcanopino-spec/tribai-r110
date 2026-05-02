"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { saveUtilidadContableAction } from "./actions";
import type { State } from "./consts";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(v: number | null | undefined): string {
  if (v == null) return "";
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "";
  return FMT.format(n);
}

function fmtInput(s: string): string {
  const negative = s.trim().startsWith("-");
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return negative ? "-" : "";
  return (negative ? "-" : "") + FMT.format(Number(cleaned));
}

export function UtilidadForm({
  declId,
  empresaId,
  initialValue,
}: {
  declId: string;
  empresaId: string;
  initialValue: number;
}) {
  const action = saveUtilidadContableAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [valor, setValor] = useState(fmt(initialValue));

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Utilidad (o pérdida) contable antes de impuestos">
        <Input
          name="cf_utilidad_contable"
          inputMode="numeric"
          value={valor}
          onChange={(e) => setValor(fmtInput(e.target.value))}
          placeholder="Tomar del Estado de Resultados"
        />
      </Field>
      <div className="flex items-center justify-between gap-3">
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : state.ok ? (
          <p className="text-sm text-muted-foreground">Guardado.</p>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar utilidad"}
        </Button>
      </div>
    </form>
  );
}
