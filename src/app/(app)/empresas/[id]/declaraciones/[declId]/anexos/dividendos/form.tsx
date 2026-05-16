"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { addDividendoAction } from "./actions";
import { CATEGORIAS, type State } from "./consts";
import { useRefreshOnSuccess } from "@/lib/use-refresh-on-success";

const initial: State = { error: null, ok: false };

export function DividendoForm({
  declId,
  empresaId,
}: {
  declId: string;
  empresaId: string;
}) {
  const action = addDividendoAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  useRefreshOnSuccess(state);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar tercero / dividendo</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Distribuye los dividendos recibidos del tercero entre las 8 categorías. Los
        que no apliquen, déjalos en cero.
      </p>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <Field label="NIT del tercero (opcional)">
            <Input name="nit" inputMode="numeric" />
          </Field>
          <Field label="Tercero">
            <Input name="tercero" required placeholder="Razón social del que distribuye" />
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {CATEGORIAS.map((c) => (
            <Field key={c.id} label={`R${c.renglon} · ${c.short}`}>
              <Input
                name={c.id}
                inputMode="numeric"
                placeholder="0"
                onChange={(e) => {
                  // formato visual de miles
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  if (!raw) {
                    e.target.value = "";
                    return;
                  }
                  e.target.value = new Intl.NumberFormat("es-CO").format(Number(raw));
                }}
              />
            </Field>
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar tercero"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
