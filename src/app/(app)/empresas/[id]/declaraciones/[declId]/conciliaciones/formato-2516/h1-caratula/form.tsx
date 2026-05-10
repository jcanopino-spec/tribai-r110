"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { saveH1Action, type SaveH1State } from "./actions";
import type { F2516H1Caratula } from "@/lib/f2516-hojas";

const ESTADO_INICIAL: SaveH1State = { ok: false, error: null };

export function H1Form({
  declId,
  empresaId,
  initial,
  empresa,
  anoGravable,
}: {
  declId: string;
  empresaId: string;
  initial: F2516H1Caratula | null;
  empresa: {
    razon_social: string;
    nit: string;
    dv: string | null;
    regimen_codigo: string | null;
    ciiu_codigo: string | null;
  };
  anoGravable: number;
}) {
  const action = saveH1Action.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);
  const router = useRouter();

  const [obligadoRF, setObligadoRF] = useState(
    initial?.obligado_revisor_fiscal ?? false,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-8">
      <Section title="3 · Representante Legal">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre completo">
            <Input name="rep_legal_nombre" defaultValue={initial?.rep_legal_nombre ?? ""} />
          </Field>
          <Field label="Cargo">
            <Input name="rep_legal_cargo" defaultValue={initial?.rep_legal_cargo ?? "Representante Legal"} />
          </Field>
          <Field label="Tipo documento">
            <select
              name="rep_legal_tipo_doc"
              defaultValue={initial?.rep_legal_tipo_doc ?? "CC"}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="PA">PA</option>
            </select>
          </Field>
          <Field label="Número documento">
            <Input name="rep_legal_numero_doc" defaultValue={initial?.rep_legal_numero_doc ?? ""} />
          </Field>
        </div>
      </Section>

      <Section title="4 · Contador Público">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre completo">
            <Input name="contador_nombre" defaultValue={initial?.contador_nombre ?? ""} />
          </Field>
          <Field label="Tarjeta profesional">
            <Input name="contador_tarjeta_prof" defaultValue={initial?.contador_tarjeta_prof ?? ""} />
          </Field>
          <Field label="Tipo documento">
            <select
              name="contador_tipo_doc"
              defaultValue={initial?.contador_tipo_doc ?? "CC"}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="PA">PA</option>
            </select>
          </Field>
          <Field label="Número documento">
            <Input name="contador_numero_doc" defaultValue={initial?.contador_numero_doc ?? ""} />
          </Field>
        </div>
      </Section>

      <Section title="5 · Revisor Fiscal">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="obligado_revisor_fiscal"
            checked={obligadoRF}
            onChange={(e) => setObligadoRF(e.target.checked)}
            className="h-4 w-4"
          />
          <span>¿La empresa está obligada a tener Revisor Fiscal?</span>
        </label>
        {obligadoRF && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Nombre completo">
              <Input name="rf_nombre" defaultValue={initial?.rf_nombre ?? ""} />
            </Field>
            <Field label="Tarjeta profesional">
              <Input name="rf_tarjeta_prof" defaultValue={initial?.rf_tarjeta_prof ?? ""} />
            </Field>
            <Field label="Tipo documento">
              <select
                name="rf_tipo_doc"
                defaultValue={initial?.rf_tipo_doc ?? "CC"}
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PA">PA</option>
              </select>
            </Field>
            <Field label="Número documento">
              <Input name="rf_numero_doc" defaultValue={initial?.rf_numero_doc ?? ""} />
            </Field>
          </div>
        )}
      </Section>

      <Section title="6 · Marco normativo y dirección">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Marco normativo contable">
            <select
              name="marco_normativo"
              defaultValue={initial?.marco_normativo ?? "NIIF Pymes"}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="NIIF Plenas">NIIF Plenas</option>
              <option value="NIIF Pymes">NIIF Pymes</option>
              <option value="NIF Microempresas">NIF Microempresas</option>
            </select>
          </Field>
          <Field label="Dirección de notificación">
            <Input name="direccion_notificacion" defaultValue={initial?.direccion_notificacion ?? ""} />
          </Field>
          <Field label="Departamento (código DANE)">
            <Input name="departamento_codigo" defaultValue={initial?.departamento_codigo ?? ""} placeholder="11" />
          </Field>
          <Field label="Municipio (código DANE)">
            <Input name="municipio_codigo" defaultValue={initial?.municipio_codigo ?? ""} placeholder="001" />
          </Field>
          <Field label="Teléfono">
            <Input name="telefono" defaultValue={initial?.telefono ?? ""} />
          </Field>
          <Field label="Correo electrónico">
            <Input name="correo" type="email" defaultValue={initial?.correo ?? ""} />
          </Field>
        </div>
      </Section>

      <Section title="Observaciones">
        <Field label="Notas sobre la carátula">
          <Input name="observaciones" defaultValue={initial?.observaciones ?? ""} />
        </Field>
      </Section>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-success">Guardado.</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar carátula"}
        </Button>
      </div>

      {/* Resumen autollenado para DIAN */}
      <Section title="Resumen autollenado · espejo del MUISCA">
        <dl className="grid gap-2 text-sm">
          <Row k="Razón social" v={empresa.razon_social} />
          <Row k="NIT" v={`${empresa.nit}${empresa.dv ? "-" + empresa.dv : ""}`} />
          <Row k="Régimen tributario" v={empresa.regimen_codigo ?? "—"} />
          <Row k="CIIU principal" v={empresa.ciiu_codigo ?? "—"} />
          <Row k="Año gravable" v={String(anoGravable)} />
          <Row k="Periodo" v="Anual" />
        </dl>
      </Section>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border p-5">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono">{v}</dd>
    </div>
  );
}
