"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { addIcaAction } from "./actions";
import type { State } from "./consts";

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

export function IcaForm({ declId, empresaId }: { declId: string; empresaId: string }) {
  const action = addIcaAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar pago de ICA</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <Field label="Municipio">
          <Input name="municipio" required placeholder="Bogotá D.C., Medellín…" />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Base gravable">
            <Input
              name="base_gravable"
              inputMode="numeric"
              onChange={(e) => (e.target.value = fmtInput(e.target.value))}
            />
          </Field>
          <Field label="Tarifa (‰)">
            <Input
              name="tarifa_milaje"
              inputMode="decimal"
              placeholder="9.66"
              onChange={(e) => (e.target.value = fmtDecimal(e.target.value))}
            />
          </Field>
          <Field label="Valor pagado">
            <Input
              name="valor_pagado"
              inputMode="numeric"
              required
              onChange={(e) => (e.target.value = fmtInput(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Observación (opcional)">
          <Input name="observacion" placeholder="Período, retenciones, etc." />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar pago"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
