"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import {
  addRetencionAction,
  CONCEPTOS_RETENCION,
  CONCEPTOS_AUTORRETENCION,
  type RetencionState,
} from "./actions";

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

  if (state.ok && formRef.current) {
    // Reset form fields after successful save
    setTimeout(() => {
      formRef.current?.reset();
      setBase("");
      setRetenido("");
    }, 0);
  }

  const conceptos = tipo === "retencion" ? CONCEPTOS_RETENCION : CONCEPTOS_AUTORRETENCION;

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar nueva línea</h2>
      <form ref={formRef} action={formAction} className="mt-5 grid gap-4 md:grid-cols-[150px_1fr_1fr_140px_140px_auto]">
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
        <Field label="Agente retenedor (opcional)">
          <Input name="agente" />
        </Field>
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
        <div className="flex items-end">
          <Button type="submit" disabled={pending}>
            {pending ? "…" : "Agregar"}
          </Button>
        </div>
      </form>
      <Field label="NIT del agente (opcional)" className="mt-4 max-w-xs">
        <Input name="nit" form="" />
      </Field>
      {state.error ? <p className="mt-3 text-sm text-destructive">{state.error}</p> : null}
    </div>
  );
}
