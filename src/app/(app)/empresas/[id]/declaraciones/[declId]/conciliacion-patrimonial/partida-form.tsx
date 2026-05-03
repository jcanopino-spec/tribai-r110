"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { addPartidaPatrimonialAction } from "./actions";
import { CONCEPTOS_AUMENTO, CONCEPTOS_DISMINUCION, type State, type Signo } from "./consts";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

export function PartidaPatrimonialForm({
  declId,
  empresaId,
}: {
  declId: string;
  empresaId: string;
}) {
  const action = addPartidaPatrimonialAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [signo, setSigno] = useState<Signo>("mas");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const sugerencias = signo === "mas" ? CONCEPTOS_AUMENTO : CONCEPTOS_DISMINUCION;

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar partida manual</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Conceptos que explican la variación del patrimonio y NO se derivan
        automáticamente del formulario 110 ni de los anexos (capitalizaciones,
        valorizaciones, distribuciones extraordinarias, etc.).
      </p>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo de partida">
            <Select
              name="signo"
              value={signo}
              onChange={(e) => setSigno(e.target.value as Signo)}
            >
              <option value="mas">(+) Aumenta el patrimonio</option>
              <option value="menos">(−) Disminuye el patrimonio</option>
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
            placeholder="Ej. Aporte de capital · emisión de acciones"
            list="conceptos-patrimonial-sugeridos"
          />
          <datalist id="conceptos-patrimonial-sugeridos">
            {sugerencias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Observación (opcional)">
          <Input name="observacion" placeholder="Soporte, escritura, acta, etc." />
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
