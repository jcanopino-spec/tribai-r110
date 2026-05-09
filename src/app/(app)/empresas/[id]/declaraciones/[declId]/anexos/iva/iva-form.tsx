"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { saveIvaAction } from "./actions";
import {
  ESTADO_INICIAL,
  PERIODICIDADES,
  type IvaItem,
  type Periodicidad,
} from "./consts";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const c = s.replace(/[^0-9-]/g, "");
  if (!c || c === "-") return c;
  const n = Number(c);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

export function IvaForm({
  declId,
  empresaId,
  periodicidad,
  periodo,
  inicial,
  onCancelar,
}: {
  declId: string;
  empresaId: string;
  periodicidad: Periodicidad;
  periodo: number;
  inicial?: IvaItem | null;
  onCancelar?: () => void;
}) {
  const action = saveIvaAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const [fields, setFields] = useState({
    fecha_presentacion: inicial?.fecha_presentacion ?? "",
    numero_formulario: inicial?.numero_formulario ?? "",
    ingresos_brutos: fmt(String(inicial?.ingresos_brutos ?? 0)),
    devoluciones: fmt(String(inicial?.devoluciones ?? 0)),
    ingresos_no_gravados: fmt(String(inicial?.ingresos_no_gravados ?? 0)),
    ingresos_exentos: fmt(String(inicial?.ingresos_exentos ?? 0)),
    ingresos_gravados: fmt(String(inicial?.ingresos_gravados ?? 0)),
    iva_generado: fmt(String(inicial?.iva_generado ?? 0)),
    iva_descontable: fmt(String(inicial?.iva_descontable ?? 0)),
    saldo_pagar: fmt(String(inicial?.saldo_pagar ?? 0)),
    saldo_favor: fmt(String(inicial?.saldo_favor ?? 0)),
    observacion: inicial?.observacion ?? "",
  });

  const cfg = PERIODICIDADES.find((p) => p.id === periodicidad)!;
  const periodoLabel = cfg.descripcionPeriodo(periodo);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      if (onCancelar) onCancelar();
    }
  }, [state, router, onCancelar]);

  function set<K extends keyof typeof fields>(
    k: K,
    v: (typeof fields)[K],
  ) {
    setFields((f) => ({ ...f, [k]: v }));
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="periodicidad" value={periodicidad} />
      <input type="hidden" name="periodo" value={periodo} />

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Periodo">
          <Input value={`${cfg.label} · ${periodoLabel}`} disabled />
        </Field>
        <Field label="Fecha de presentación">
          <Input
            name="fecha_presentacion"
            type="date"
            value={fields.fecha_presentacion}
            onChange={(e) => set("fecha_presentacion", e.target.value)}
          />
        </Field>
        <Field label="Número formulario 300">
          <Input
            name="numero_formulario"
            value={fields.numero_formulario}
            onChange={(e) => set("numero_formulario", e.target.value)}
            placeholder="9100xxxxxxx"
          />
        </Field>
      </div>

      <h3 className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        Ingresos del periodo
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <NumField
          name="ingresos_brutos"
          label="Ingresos brutos (cas. 39)"
          value={fields.ingresos_brutos}
          onChange={(v) => set("ingresos_brutos", v)}
        />
        <NumField
          name="devoluciones"
          label="Devoluciones (cas. 40)"
          value={fields.devoluciones}
          onChange={(v) => set("devoluciones", v)}
        />
        <NumField
          name="ingresos_gravados"
          label="Gravados (cas. 27 + 28)"
          value={fields.ingresos_gravados}
          onChange={(v) => set("ingresos_gravados", v)}
        />
        <NumField
          name="ingresos_no_gravados"
          label="No gravados (cas. 38)"
          value={fields.ingresos_no_gravados}
          onChange={(v) => set("ingresos_no_gravados", v)}
        />
        <NumField
          name="ingresos_exentos"
          label="Exentos (cas. 35)"
          value={fields.ingresos_exentos}
          onChange={(v) => set("ingresos_exentos", v)}
        />
      </div>

      <h3 className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        IVA y saldos
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <NumField
          name="iva_generado"
          label="IVA generado"
          value={fields.iva_generado}
          onChange={(v) => set("iva_generado", v)}
        />
        <NumField
          name="iva_descontable"
          label="IVA descontable"
          value={fields.iva_descontable}
          onChange={(v) => set("iva_descontable", v)}
        />
        <NumField
          name="saldo_pagar"
          label="Saldo a pagar"
          value={fields.saldo_pagar}
          onChange={(v) => set("saldo_pagar", v)}
        />
        <NumField
          name="saldo_favor"
          label="Saldo a favor"
          value={fields.saldo_favor}
          onChange={(v) => set("saldo_favor", v)}
        />
      </div>

      <h3 className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        Soporte y observaciones
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="PDF del formulario 300 (opcional · max 10 MB)">
          <input
            type="file"
            name="pdf_file"
            accept="application/pdf"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:text-background file:hover:opacity-90 file:cursor-pointer"
          />
          {inicial?.pdf_filename ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Actual: {inicial.pdf_filename} (subir reemplaza)
            </p>
          ) : null}
        </Field>
        <Field label="Observación">
          <Input
            name="observacion"
            value={fields.observacion}
            onChange={(e) => set("observacion", e.target.value)}
            placeholder="Notas, referencias, etc."
          />
        </Field>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-success">Guardado.</p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar declaración"}
        </Button>
        {onCancelar ? (
          <button
            type="button"
            onClick={onCancelar}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}

function NumField({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        name={name}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(fmt(e.target.value))}
        className="text-right"
        placeholder="0"
      />
    </Field>
  );
}
