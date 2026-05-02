"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { addIncrngoAction } from "./actions";
import { PLANTILLAS, type State } from "./consts";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

export function IncrngoForm({
  declId,
  empresaId,
}: {
  declId: string;
  empresaId: string;
}) {
  const action = addIncrngoAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [concepto, setConcepto] = useState("");
  const [normatividad, setNormatividad] = useState("");
  const [valor, setValor] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setConcepto("");
      setNormatividad("");
      setValor("");
    }
  }, [state.ok]);

  function aplicar(idx: number) {
    const p = PLANTILLAS[idx];
    setConcepto(p.c);
    setNormatividad(p.n);
  }

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar INCRNGO</h2>
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
                {p.c.slice(0, 90)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Concepto">
          <Input
            name="concepto"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            required
          />
        </Field>
        <Field label="Normatividad">
          <Input
            name="normatividad"
            value={normatividad}
            onChange={(e) => setNormatividad(e.target.value)}
            placeholder="Art. 48 ET"
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="Valor">
            <Input
              name="valor"
              inputMode="numeric"
              value={valor}
              onChange={(e) => setValor(fmt(e.target.value))}
              required
            />
          </Field>
          <div>
            <Button type="submit" disabled={pending} className="w-full md:w-auto">
              {pending ? "Guardando…" : "Agregar"}
            </Button>
          </div>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
