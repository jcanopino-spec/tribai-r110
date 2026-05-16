"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { addCompensacionAction } from "./actions";
import { TIPOS, type Tipo, type State } from "./consts";
import { useRefreshOnSuccess } from "@/lib/use-refresh-on-success";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

export function CompensacionForm({
  declId,
  empresaId,
  anoActual,
}: {
  declId: string;
  empresaId: string;
  anoActual: number;
}) {
  const action = addCompensacionAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  useRefreshOnSuccess(state);
  const [tipo, setTipo] = useState<Tipo>("perdida");
  const [original, setOriginal] = useState("");
  const [comp, setComp] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [lastSeen, setLastSeen] = useState(state);
  if (state !== lastSeen) {
    setLastSeen(state);
    if (state.ok) {
      setOriginal("");
      setComp("");
    }
  }
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const tipoConfig = TIPOS.find((t) => t.id === tipo);

  // Año por defecto: AG anterior; rangos según tipo
  const minAno = tipo === "perdida" ? anoActual - 12 : anoActual - 5;
  const maxAno = anoActual - 1;

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar compensación</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <Field label="Tipo">
            <Select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Año de origen de la pérdida">
            <Input
              name="ano_origen"
              type="number"
              min={minAno}
              max={maxAno}
              defaultValue={maxAno}
              required
            />
          </Field>
        </div>
        {tipoConfig ? (
          <p className="text-xs text-muted-foreground">{tipoConfig.help}</p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Pérdida / exceso original (informativo)">
            <Input
              name="perdida_original"
              inputMode="numeric"
              value={original}
              onChange={(e) => setOriginal(fmt(e.target.value))}
            />
          </Field>
          <Field label="Valor a compensar este año">
            <Input
              name="compensar"
              inputMode="numeric"
              value={comp}
              onChange={(e) => setComp(fmt(e.target.value))}
              required
            />
          </Field>
        </div>
        <Field label="Observación (opcional)">
          <Input name="observacion" />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar compensación"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
