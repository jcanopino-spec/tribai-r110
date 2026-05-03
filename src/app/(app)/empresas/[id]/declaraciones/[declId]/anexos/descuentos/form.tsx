"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { addDescuentoAction } from "./actions";
import {
  CATEGORIAS,
  PLANTILLAS,
  type Categoria,
  type DescuentoState,
} from "./consts";

const initial: DescuentoState = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

export function DescuentoForm({
  declId,
  empresaId,
}: {
  declId: string;
  empresaId: string;
}) {
  const action = addDescuentoAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [categoria, setCategoria] = useState<Categoria>("otros");
  const [descripcion, setDescripcion] = useState("");
  const [normatividad, setNormatividad] = useState("");
  const [base, setBase] = useState("");
  const [valor, setValor] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [lastSeen, setLastSeen] = useState(state);
  if (state !== lastSeen) {
    setLastSeen(state);
    if (state.ok) {
      setBase("");
      setValor("");
      setDescripcion("");
      setNormatividad("");
    }
  }
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function aplicarPlantilla(idx: number) {
    const p = PLANTILLAS[categoria][idx];
    setDescripcion(p.descripcion);
    setNormatividad(p.normatividad);
  }

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar descuento</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <Field label="Categoría">
            <Select
              name="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Categoria)}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plantilla (autocompleta descripción y norma)">
            <Select
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v !== "") aplicarPlantilla(Number(v));
                e.target.value = "";
              }}
            >
              <option value="">— elegir o escribir manual —</option>
              {PLANTILLAS[categoria].map((p, i) => (
                <option key={i} value={i}>
                  {p.descripcion.slice(0, 70)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Descripción del descuento">
          <Input
            name="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="50% del ICA pagado, etc."
            required
          />
        </Field>
        <Field label="Normatividad (artículo / ley)">
          <Input
            name="normatividad"
            value={normatividad}
            onChange={(e) => setNormatividad(e.target.value)}
            placeholder="Art. 115 E.T."
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="Valor pago / abono en cuenta (base)">
            <Input
              name="base"
              inputMode="numeric"
              value={base}
              onChange={(e) => setBase(fmt(e.target.value))}
            />
          </Field>
          <Field label="Valor descuento tributario">
            <Input
              name="valor_descuento"
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
