"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { addRecuperacionAction } from "./actions";
import { PLANTILLAS, type State } from "./consts";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

export function RecuperacionForm({
  declId,
  empresaId,
}: {
  declId: string;
  empresaId: string;
}) {
  const action = addRecuperacionAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [concepto, setConcepto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [valor, setValor] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [lastSeen, setLastSeen] = useState(state);
  if (state !== lastSeen) {
    setLastSeen(state);
    if (state.ok) {
      setConcepto("");
      setDescripcion("");
      setValor("");
    }
  }
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function aplicar(idx: number) {
    const p = PLANTILLAS[idx];
    setConcepto(p.c);
    setDescripcion(p.d);
  }

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar recuperación</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <Field label="Plantilla (autocompleta)">
          <Select
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "") aplicar(Number(v));
              e.target.value = "";
            }}
          >
            <option value="">— elegir o escribir manual —</option>
            {PLANTILLAS.map((p, i) => (
              <option key={i} value={i}>
                {p.c}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Concepto">
            <Input
              name="concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Recuperación de deterioros"
              required
            />
          </Field>
          <Field label="Valor">
            <Input
              name="valor"
              inputMode="numeric"
              value={valor}
              onChange={(e) => setValor(fmt(e.target.value))}
              required
            />
          </Field>
        </div>
        <Field label="Descripción detallada">
          <Input
            name="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
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
