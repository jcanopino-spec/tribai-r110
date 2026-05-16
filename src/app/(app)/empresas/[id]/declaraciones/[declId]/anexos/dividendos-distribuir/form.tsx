"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { addDivDistAction } from "./actions";
import type { State } from "./consts";
import { useRefreshOnSuccess } from "@/lib/use-refresh-on-success";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

function fmtDecimal(s: string): string {
  return s.replace(/[^0-9.,]/g, "");
}

export function DivDistForm({ declId, empresaId }: { declId: string; empresaId: string }) {
  const action = addDivDistAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  useRefreshOnSuccess(state);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar socio</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Socio">
            <Input name="socio" required placeholder="Nombre / Razón social" />
          </Field>
          <Field label="NIT / Cédula (opcional)">
            <Input name="nit" />
          </Field>
          <Field label="Participación (%)">
            <Input
              name="participacion_pct"
              inputMode="decimal"
              placeholder="50.00"
              onChange={(e) => (e.target.value = fmtDecimal(e.target.value))}
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Dividendo no gravado">
            <Input
              name="dividendo_no_gravado"
              inputMode="numeric"
              onChange={(e) => (e.target.value = fmtInput(e.target.value))}
            />
          </Field>
          <Field label="Dividendo gravado">
            <Input
              name="dividendo_gravado"
              inputMode="numeric"
              onChange={(e) => (e.target.value = fmtInput(e.target.value))}
            />
          </Field>
          <Field label="Retención aplicable">
            <Input
              name="retencion_aplicable"
              inputMode="numeric"
              onChange={(e) => (e.target.value = fmtInput(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Observación (opcional)">
          <Input name="observacion" />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
