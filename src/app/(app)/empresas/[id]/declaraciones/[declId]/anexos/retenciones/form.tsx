"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { addRetencionAction } from "./actions";
import {
  CONCEPTOS_RETENCION,
  CONCEPTOS_AUTORRETENCION,
  type RetencionState,
} from "./consts";

const initial: RetencionState = { error: null, ok: false };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

export function RetencionForm({
  declId,
  empresaId,
}: {
  declId: string;
  empresaId: string;
}) {
  const action = addRetencionAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [tipo, setTipo] = useState<"retencion" | "autorretencion">("retencion");
  const [base, setBase] = useState("");
  const [retenido, setRetenido] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [lastSeen, setLastSeen] = useState(state);
  if (state !== lastSeen) {
    setLastSeen(state);
    if (state.ok) {
      setBase("");
      setRetenido("");
    }
  }
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const conceptos = tipo === "retencion" ? CONCEPTOS_RETENCION : CONCEPTOS_AUTORRETENCION;

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar nueva línea</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo">
            <Select
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "retencion" | "autorretencion")}
            >
              <option value="retencion">Retención</option>
              <option value="autorretencion">Autorretención</option>
            </Select>
          </Field>
          <Field label="Concepto">
            <Select name="concepto" defaultValue={conceptos[0]}>
              {conceptos.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <Field label="Agente retenedor (opcional)">
            <Input name="agente" />
          </Field>
          <Field label="NIT del agente (opcional)">
            <Input name="nit" />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="Base">
            <Input
              name="base"
              inputMode="numeric"
              value={base}
              onChange={(e) => setBase(fmt(e.target.value))}
            />
          </Field>
          <Field label="Retenido">
            <Input
              name="retenido"
              inputMode="numeric"
              value={retenido}
              onChange={(e) => setRetenido(fmt(e.target.value))}
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
