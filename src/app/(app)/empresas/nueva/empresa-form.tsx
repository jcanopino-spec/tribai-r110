"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { calcularDV } from "@/lib/nit";
import { createEmpresaAction, type EmpresaState } from "../actions";

const initial: EmpresaState = { error: null };

export function EmpresaForm({
  ciius,
  dians,
  regimenes,
}: {
  ciius: { codigo: string; descripcion: string }[];
  dians: { codigo: string; nombre: string }[];
  regimenes: { codigo: string; descripcion: string }[];
}) {
  const [state, formAction, pending] = useActionState(createEmpresaAction, initial);
  const [nit, setNit] = useState("");
  const dv = useMemo(() => calcularDV(nit) ?? "", [nit]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="NIT">
          <Input
            name="nit"
            inputMode="numeric"
            value={nit}
            onChange={(e) => setNit(e.target.value.replace(/\D/g, ""))}
            required
          />
        </Field>
        <Field label="DV (auto)">
          <Input name="dv" value={dv} readOnly tabIndex={-1} className="bg-muted text-center" />
        </Field>
      </div>

      <Field label="Razón social">
        <Input name="razon_social" required />
      </Field>

      <Field label="Actividad económica (CIIU)">
        <Select name="ciiu_codigo" defaultValue="">
          <option value="">— seleccionar —</option>
          {ciius.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.codigo} · {c.descripcion}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Dirección Seccional DIAN">
        <Select name="direccion_seccional_codigo" defaultValue="">
          <option value="">— seleccionar —</option>
          {dians.map((d) => (
            <option key={d.codigo} value={d.codigo}>
              {d.codigo} · {d.nombre}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Régimen tributario">
        <Select name="regimen_codigo" defaultValue="">
          <option value="">— seleccionar —</option>
          {regimenes.map((r) => (
            <option key={r.codigo} value={r.codigo}>
              {r.codigo} · {r.descripcion.slice(0, 80)}
            </option>
          ))}
        </Select>
      </Field>

      {state.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Crear empresa"}
      </Button>
    </form>
  );
}
