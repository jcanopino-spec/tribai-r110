"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { addPredialAction } from "./actions";
import type { State } from "./consts";
import { useRefreshOnSuccess } from "@/lib/use-refresh-on-success";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

export function PredialForm({ declId, empresaId }: { declId: string; empresaId: string }) {
  const action = addPredialAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  useRefreshOnSuccess(state);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar predio</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <Field label="Identificación del predio">
          <Input name="predio" required placeholder="Bodega, oficina, lote…" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Dirección (opcional)">
            <Input name="direccion" />
          </Field>
          <Field label="Matrícula inmobiliaria (opcional)">
            <Input name="matricula" />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Avalúo catastral">
            <Input
              name="avaluo"
              inputMode="numeric"
              onChange={(e) => (e.target.value = fmtInput(e.target.value))}
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
