"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { addInversionEsalAction } from "./actions";
import { CATEGORIAS_ESAL, ESTADO_INICIAL, type TipoInversion } from "./consts";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

export function InversionEsalForm({
  declId,
  empresaId,
  anoActual,
}: {
  declId: string;
  empresaId: string;
  anoActual: number;
}) {
  const action = addInversionEsalAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<TipoInversion>("efectuada");
  const [valor, setValor] = useState("");
  const [concepto, setConcepto] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [lastSeen, setLastSeen] = useState(state);
  if (state !== lastSeen) {
    setLastSeen(state);
    if (state.ok) {
      setValor("");
      setConcepto("");
    }
  }
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar inversión</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo">
            <Select
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoInversion)}
              required
            >
              <option value="efectuada">Efectuada en el año (R68)</option>
              <option value="liquidada">Liquidada de años anteriores (R69)</option>
            </Select>
          </Field>
          <Field label="Categoría">
            <Select name="categoria" defaultValue="">
              <option value="">— elegir —</option>
              {CATEGORIAS_ESAL.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Concepto">
          <Input
            name="concepto"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder={
              tipo === "efectuada"
                ? "Compra de equipo médico para el programa"
                : "Liquidación inversión 2022 · vencida en 2025"
            }
            required
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Valor">
            <Input
              name="valor"
              inputMode="numeric"
              value={valor}
              onChange={(e) => setValor(fmt(e.target.value))}
              required
            />
          </Field>
          <Field label={tipo === "efectuada" ? "Fecha de compra" : "Fecha de liquidación"}>
            <Input name="fecha" type="date" />
          </Field>
          <Field
            label={
              tipo === "efectuada"
                ? "AG (auto)"
                : "AG en que se efectuó originalmente"
            }
          >
            <Input
              name="ano_origen"
              type="number"
              inputMode="numeric"
              defaultValue={tipo === "efectuada" ? anoActual : ""}
              placeholder={tipo === "efectuada" ? String(anoActual) : "AG anterior"}
            />
          </Field>
        </div>

        <Field label="Observación (opcional)">
          <Input name="observacion" placeholder="Notas, soportes, referencias" />
        </Field>

        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
        {state.ok ? (
          <p className="text-sm text-success">Inversión guardada.</p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Agregar inversión"}
        </Button>
      </form>
    </div>
  );
}
