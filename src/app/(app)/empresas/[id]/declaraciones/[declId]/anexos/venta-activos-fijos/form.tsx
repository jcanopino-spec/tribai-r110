"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { addVentaAfAction } from "./actions";
import type { State } from "./consts";
import { useRefreshOnSuccess } from "@/lib/use-refresh-on-success";

const initial: State = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const c = s.replace(/[^0-9]/g, "");
  if (!c) return "";
  return FMT.format(Number(c));
}

export function VentaAfForm({
  declId,
  empresaId,
}: {
  declId: string;
  empresaId: string;
}) {
  const action = addVentaAfAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  useRefreshOnSuccess(state);
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [depreciacion, setDepreciacion] = useState("");
  const [reajustes, setReajustes] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [lastSeen, setLastSeen] = useState(state);
  if (state !== lastSeen) {
    setLastSeen(state);
    if (state.ok) {
      setPrecio("");
      setCosto("");
      setDepreciacion("");
      setReajustes("");
    }
  }
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="border border-border p-5">
      <h2 className="font-serif text-xl">Agregar venta de activo fijo</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Posesión {">"}{" "}2 años → ganancia ocasional (suma R80/R81). Posesión ≤
        2 años → renta líquida ordinaria (informativo).
      </p>
      <form ref={formRef} action={formAction} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Detalle del activo">
            <Input
              name="detalle_activo"
              required
              placeholder="Vehículo placa ABC123, Maquinaria X, etc."
            />
          </Field>
          <Field label="NIT/CC comprador (opcional)">
            <Input name="nit_comprador" placeholder="900123456-7" />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fecha de compra">
            <Input name="fecha_compra" type="date" />
          </Field>
          <Field label="Fecha de venta">
            <Input name="fecha_venta" type="date" />
          </Field>
        </div>
        <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm cursor-pointer hover:bg-muted/30">
          <input
            type="checkbox"
            name="posesion_mas_2_anos"
            defaultChecked
            className="mt-0.5 h-4 w-4 accent-foreground"
          />
          <div>
            <span>Activo poseído por más de 2 años (Ganancia Ocasional)</span>
            <p className="mt-1 text-xs text-muted-foreground">
              Si está marcado, esta venta alimenta R80 (ingresos GO) y R81
              (costos GO). Sino, queda como informativa porque los
              ingresos/costos contables ya están en el balance.
            </p>
          </div>
        </label>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Precio de venta">
            <Input
              name="precio_venta"
              required
              inputMode="numeric"
              value={precio}
              onChange={(e) => setPrecio(fmt(e.target.value))}
            />
          </Field>
          <Field label="Costo fiscal">
            <Input
              name="costo_fiscal"
              inputMode="numeric"
              value={costo}
              onChange={(e) => setCosto(fmt(e.target.value))}
            />
          </Field>
          <Field label="Depreciación acumulada">
            <Input
              name="depreciacion_acumulada"
              inputMode="numeric"
              value={depreciacion}
              onChange={(e) => setDepreciacion(fmt(e.target.value))}
            />
          </Field>
          <Field label="Reajustes fiscales">
            <Input
              name="reajustes_fiscales"
              inputMode="numeric"
              value={reajustes}
              onChange={(e) => setReajustes(fmt(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Observación (opcional)">
          <Input name="observacion" />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar venta"}
          </Button>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}
