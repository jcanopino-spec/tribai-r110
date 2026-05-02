"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { addDifCambioAction } from "./actions";
import type { Tipo, State } from "./consts";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 });

function fmt(s: string): string {
  // Permite decimales para USD y TRM
  return s.replace(/[^0-9.,]/g, "");
}

export function DifCambioForm({
  declId,
  empresaId,
  trmFinal,
}: {
  declId: string;
  empresaId: string;
  trmFinal: number;
}) {
  const action = addDifCambioAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [tipo, setTipo] = useState<Tipo>("activo");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar partida</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        TRM final aplicada para el cálculo: {FMT.format(trmFinal)}
      </p>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-[150px_1fr_1fr]">
          <Field label="Tipo">
            <Select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              <option value="activo">Activo</option>
              <option value="pasivo">Pasivo</option>
            </Select>
          </Field>
          <Field label="Cuenta PUC (opcional)">
            <Input name="cuenta" placeholder="1305 / 2205" />
          </Field>
          <Field label="NIT (opcional)">
            <Input name="nit" />
          </Field>
        </div>
        <Field label="Tercero">
          <Input name="tercero" required placeholder="Razón social" />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Fecha transacción">
            <Input name="fecha_transaccion" type="date" />
          </Field>
          <Field label="Valor en USD">
            <Input
              name="valor_usd"
              inputMode="decimal"
              required
              onChange={(e) => (e.target.value = fmt(e.target.value))}
            />
          </Field>
          <Field label="TRM inicial (fecha transacción)">
            <Input
              name="trm_inicial"
              inputMode="decimal"
              required
              onChange={(e) => (e.target.value = fmt(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Observación (opcional)">
          <Input name="observacion" />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar partida"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
