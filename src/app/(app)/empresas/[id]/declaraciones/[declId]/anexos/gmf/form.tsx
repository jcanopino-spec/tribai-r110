"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { addGmfAction } from "./actions";
import type { State } from "./consts";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

export function GmfForm({ declId, empresaId }: { declId: string; empresaId: string }) {
  const action = addGmfAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar pago de GMF</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Entidad financiera">
            <Input name="entidad" required placeholder="Bancolombia, Davivienda…" />
          </Field>
          <Field label="Período (opcional)">
            <Input name="periodo" placeholder="ene-mar 2025" />
          </Field>
        </div>
        <Field label="Valor GMF pagado">
          <Input
            name="valor_gmf"
            inputMode="numeric"
            required
            onChange={(e) => (e.target.value = fmtInput(e.target.value))}
          />
        </Field>
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
