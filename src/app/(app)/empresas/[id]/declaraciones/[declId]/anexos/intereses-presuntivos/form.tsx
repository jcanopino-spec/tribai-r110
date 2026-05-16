"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { addInteresAction } from "./actions";
import type { State } from "./consts";
import { useRefreshOnSuccess } from "@/lib/use-refresh-on-success";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

export function InteresForm({
  declId,
  empresaId,
}: {
  declId: string;
  empresaId: string;
}) {
  const action = addInteresAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  useRefreshOnSuccess(state);
  const [saldo, setSaldo] = useState("");
  const [registrado, setRegistrado] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [lastSeen, setLastSeen] = useState(state);
  if (state !== lastSeen) {
    setLastSeen(state);
    if (state.ok) {
      setSaldo("");
      setRegistrado("");
    }
  }
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar préstamo</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Field label="Socio / Accionista">
            <Input name="socio" required placeholder="Razón social o nombre" />
          </Field>
          <Field label="Cuenta PUC (opcional)">
            <Input name="cuenta" placeholder="135295" />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Saldo promedio del préstamo">
            <Input
              name="saldo_promedio"
              inputMode="numeric"
              value={saldo}
              onChange={(e) => setSaldo(fmt(e.target.value))}
              required
            />
          </Field>
          <Field label="Días que duró el préstamo">
            <Input name="dias" type="number" defaultValue={360} min={1} max={365} />
          </Field>
          <Field label="Interés registrado contablemente">
            <Input
              name="interes_registrado"
              inputMode="numeric"
              value={registrado}
              onChange={(e) => setRegistrado(fmt(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Observación (opcional)">
          <Input name="observacion" />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar préstamo"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
