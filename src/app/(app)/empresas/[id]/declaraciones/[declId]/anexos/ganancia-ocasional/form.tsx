"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { addGoAction } from "./actions";
import { CATEGORIAS, pideCostoFiscal, type Categoria, type GoState } from "./consts";

const initial: GoState = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

export function GoForm({
  declId,
  empresaId,
}: {
  declId: string;
  empresaId: string;
}) {
  const action = addGoAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [categoria, setCategoria] = useState<Categoria>("activo_fijo");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [noGravada, setNoGravada] = useState("");
  const [recDep, setRecDep] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [lastSeen, setLastSeen] = useState(state);
  if (state !== lastSeen) {
    setLastSeen(state);
    if (state.ok) {
      setPrecio("");
      setCosto("");
      setNoGravada("");
      setRecDep("");
    }
  }
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const requiereCosto = pideCostoFiscal(categoria);
  const cat = CATEGORIAS.find((c) => c.id === categoria);

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar operación</h2>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
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
          <Field label="Concepto / detalle">
            <Input
              name="concepto"
              placeholder={cat?.descripcion ?? ""}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Precio de venta / valor recibido">
            <Input
              name="precio_venta"
              inputMode="numeric"
              value={precio}
              onChange={(e) => setPrecio(fmt(e.target.value))}
              required
            />
          </Field>
          {requiereCosto ? (
            <Field label="Costo fiscal">
              <Input
                name="costo_fiscal"
                inputMode="numeric"
                value={costo}
                onChange={(e) => setCosto(fmt(e.target.value))}
              />
            </Field>
          ) : (
            <input type="hidden" name="costo_fiscal" value="0" />
          )}
          <Field label="No gravada / exenta">
            <Input
              name="no_gravada"
              inputMode="numeric"
              value={noGravada}
              onChange={(e) => setNoGravada(fmt(e.target.value))}
            />
          </Field>
        </div>
        {categoria === "activo_fijo" ? (
          <Field label="Recuperación de depreciación (informativo)">
            <Input
              name="recuperacion_depreciacion"
              inputMode="numeric"
              value={recDep}
              onChange={(e) => setRecDep(fmt(e.target.value))}
            />
          </Field>
        ) : (
          <input type="hidden" name="recuperacion_depreciacion" value="0" />
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar operación"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
