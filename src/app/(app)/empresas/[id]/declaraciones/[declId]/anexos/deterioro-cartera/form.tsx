"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { saveDcAction, type DcState } from "./actions";

const initial: DcState = { error: null, ok: false };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n === 0) return "";
  return FMT.format(n);
}

function fmtInput(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

type Metodo = "general" | "individual" | "combinado";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DcForm({ declId, empresaId, declaracion }: any) {
  const action = saveDcAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);

  const [c0_90, setC0_90] = useState(fmt(declaracion.dc_cartera_0_90));
  const [c91_180, setC91_180] = useState(fmt(declaracion.dc_cartera_91_180));
  const [c181_360, setC181_360] = useState(fmt(declaracion.dc_cartera_181_360));
  const [c360_mas, setC360_mas] = useState(fmt(declaracion.dc_cartera_360_mas));
  const [metodo, setMetodo] = useState<Metodo>(declaracion.dc_metodo ?? "general");
  const [saldoContable, setSaldoContable] = useState(fmt(declaracion.dc_saldo_contable));

  const v0 = parseNum(c0_90);
  const v91 = parseNum(c91_180);
  const v181 = parseNum(c181_360);
  const v360 = parseNum(c360_mas);
  const totalCartera = v0 + v91 + v181 + v360;

  // Provisión General (Art. 39 Dec. 187/1975)
  const provGeneral = v0 * 0 + v91 * 0.05 + v181 * 0.10 + v360 * 0.15;
  // Provisión Individual (Art. 40 Dec. 187/1975)
  const provIndividual = v360 * 0.33;
  // Combinado: el mayor de los dos
  const provCombinado = Math.max(provGeneral, provIndividual);

  const provFiscal =
    metodo === "general"
      ? provGeneral
      : metodo === "individual"
        ? provIndividual
        : provCombinado;

  const saldoCont = parseNum(saldoContable);
  const ajusteFiscal = provFiscal - saldoCont;

  return (
    <form action={formAction} className="space-y-8">
      <section>
        <h3 className="font-serif text-xl">Cartera por antigüedad</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <NumF
            name="dc_cartera_0_90"
            label="0 a 90 días (no genera provisión)"
            value={c0_90}
            set={setC0_90}
            tarifa="0%"
          />
          <NumF
            name="dc_cartera_91_180"
            label="91 a 180 días"
            value={c91_180}
            set={setC91_180}
            tarifa="5%"
          />
          <NumF
            name="dc_cartera_181_360"
            label="181 a 360 días"
            value={c181_360}
            set={setC181_360}
            tarifa="10%"
          />
          <NumF
            name="dc_cartera_360_mas"
            label="Más de 360 días"
            value={c360_mas}
            set={setC360_mas}
            tarifa="15% / 33%"
          />
        </div>
        <p className="mt-3 text-sm">
          <span className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Total cartera:
          </span>{" "}
          <span className="font-mono">{FMT.format(totalCartera)}</span>
        </p>
      </section>

      <section>
        <h3 className="font-serif text-xl">Método de cálculo</h3>
        <Field label="Selecciona el método (Tribai sugiere el de mayor beneficio)">
          <Select name="dc_metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as Metodo)}>
            <option value="general">Provisión General (5/10/15% por antigüedad)</option>
            <option value="individual">Provisión Individual (33% sobre +360 días)</option>
            <option value="combinado">Combinado (el mayor entre los dos)</option>
          </Select>
        </Field>
      </section>

      <section>
        <h3 className="font-serif text-xl">Resultado</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat label="Provisión General" value={provGeneral} active={metodo === "general"} />
          <Stat label="Provisión Individual" value={provIndividual} active={metodo === "individual"} />
          <Stat label="Combinado" value={provCombinado} active={metodo === "combinado"} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Saldo contable de la provisión (cuenta 1399)">
            <Input
              name="dc_saldo_contable"
              inputMode="numeric"
              value={saldoContable}
              onChange={(e) => setSaldoContable(fmtInput(e.target.value))}
            />
          </Field>
          <div className="border border-foreground bg-foreground p-5 text-background">
            <p className="font-mono text-xs uppercase tracking-[0.05em] text-background/70">
              Ajuste fiscal sugerido
            </p>
            <p className="mt-2 font-serif text-2xl tracking-[-0.02em]">
              {FMT.format(ajusteFiscal)}
            </p>
            <p className="mt-1 text-xs text-background/70">
              {ajusteFiscal > 0
                ? "Mayor provisión fiscal: ajuste débito en gasto fiscal."
                : ajusteFiscal < 0
                  ? "Menor provisión fiscal: ajuste crédito (reverso parcial)."
                  : "Provisión fiscal igual a la contable: sin ajuste."}
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : <span />}
        {state.ok ? <p className="text-sm text-muted-foreground">Guardado.</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function NumF({
  name,
  label,
  value,
  set,
  tarifa,
}: {
  name: string;
  label: string;
  value: string;
  set: (v: string) => void;
  tarifa: string;
}) {
  return (
    <div>
      <Field label={`${label} · tarifa ${tarifa}`}>
        <Input
          name={name}
          inputMode="numeric"
          value={value}
          onChange={(e) => set(fmtInput(e.target.value))}
        />
      </Field>
    </div>
  );
}

function Stat({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <div
      className={`border p-4 ${
        active ? "border-foreground bg-muted/40" : "border-border"
      }`}
    >
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 font-serif text-xl tracking-[-0.02em] ${active ? "font-medium" : ""}`}>
        {FMT.format(value)}
      </p>
    </div>
  );
}
