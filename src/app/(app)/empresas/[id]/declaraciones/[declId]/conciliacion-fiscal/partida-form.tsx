"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { addPartidaAction } from "./actions";
import { CONCEPTOS_PERMANENTES, CONCEPTOS_TEMPORALES, type State, type Tipo, type Signo } from "./consts";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

export function PartidaForm({ declId, empresaId }: { declId: string; empresaId: string }) {
  const action = addPartidaAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [tipo, setTipo] = useState<Tipo>("permanente");
  const [signo, setSigno] = useState<Signo>("mas");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const sugerencias = tipo === "permanente" ? CONCEPTOS_PERMANENTES : CONCEPTOS_TEMPORALES;

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar partida conciliatoria</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Tipo">
            <Select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              <option value="permanente">Diferencia permanente</option>
              <option value="temporal">Diferencia temporal</option>
            </Select>
          </Field>
          <Field label="Signo">
            <Select name="signo" value={signo} onChange={(e) => setSigno(e.target.value as Signo)}>
              <option value="mas">(+) Suma a la utilidad</option>
              <option value="menos">(−) Resta a la utilidad</option>
            </Select>
          </Field>
          <Field label="Valor">
            <Input
              name="valor"
              inputMode="numeric"
              required
              onChange={(e) => (e.target.value = fmtInput(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Concepto">
          <Input
            name="concepto"
            required
            placeholder="Ej. Multas y sanciones"
            list="conceptos-sugeridos"
          />
          <datalist id="conceptos-sugeridos">
            {sugerencias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Observación (opcional)">
          <Input name="observacion" placeholder="Soporte, cuenta PUC, etc." />
        </Field>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {tipo === "permanente"
              ? "Permanente: no se revierte en períodos futuros (no genera impuesto diferido)."
              : "Temporal: se revierte en períodos futuros (genera activo o pasivo por impuesto diferido)."}
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar partida"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
