"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { F2516_H4_CATEGORIAS, computarH4, type F2516H4Captura } from "@/engine/f2516-h4";
import { saveH4Action, type SaveH4State } from "./actions";

const ESTADO: SaveH4State = { ok: false, error: null };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const c = s.replace(/[^\d.\-]/g, "");
  if (!c || c === "-") return c;
  const n = Number(c);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

type FilaState = {
  bc: string;
  bf: string;
  tarifa: string;
  observacion: string;
};

export function H4Form({
  declId,
  empresaId,
  initial,
}: {
  declId: string;
  empresaId: string;
  initial: F2516H4Captura[];
}) {
  const router = useRouter();
  const action = saveH4Action.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, ESTADO);

  const initialMap = new Map<string, F2516H4Captura>();
  for (const c of initial) initialMap.set(c.categoria_id, c);

  const [rows, setRows] = useState<Record<string, FilaState>>(() => {
    const out: Record<string, FilaState> = {};
    for (const cat of F2516_H4_CATEGORIAS) {
      const c = initialMap.get(cat.id);
      out[cat.id] = {
        bc: c ? fmt(String(c.base_contable)) : "",
        bf: c ? fmt(String(c.base_fiscal)) : "",
        tarifa: c ? String(c.tarifa) : "0.35",
        observacion: c?.observacion ?? "",
      };
    }
    return out;
  });

  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);

  // Cálculo en vivo del impuesto diferido
  const live: F2516H4Captura[] = F2516_H4_CATEGORIAS.map((cat) => ({
    declaracion_id: declId,
    categoria_id: cat.id,
    tipo: cat.tipo,
    base_contable: Number(rows[cat.id]?.bc.replace(/[^\d.\-]/g, "") || 0),
    base_fiscal: Number(rows[cat.id]?.bf.replace(/[^\d.\-]/g, "") || 0),
    tarifa: Number(rows[cat.id]?.tarifa || 0.35),
    observacion: rows[cat.id]?.observacion ?? null,
  }));
  const resumen = computarH4(live);

  const setCell = (id: string, key: keyof FilaState, val: string) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], [key]: val } }));

  const atd = F2516_H4_CATEGORIAS.filter((c) => c.tipo === "atd");
  const ptd = F2516_H4_CATEGORIAS.filter((c) => c.tipo === "ptd");

  return (
    <form action={formAction} className="space-y-8">
      <Section
        title="Activos por Impuesto Diferido (ATD)"
        ayuda="Diferencias temporarias deducibles · base contable > base fiscal · alimenta R165 del ESF"
      >
        <Tabla cats={atd} rows={rows} setCell={setCell} resumen={resumen} />
      </Section>

      <Section
        title="Pasivos por Impuesto Diferido (PTD)"
        ayuda="Diferencias temporarias imponibles · base fiscal > base contable · alimenta R240 del ESF"
      >
        <Tabla cats={ptd} rows={rows} setCell={setCell} resumen={resumen} />
      </Section>

      <div className="grid gap-3 md:grid-cols-3">
        <ResumenCard label="Total ATD" value={resumen.totalATD} good />
        <ResumenCard label="Total PTD" value={resumen.totalPTD} />
        <ResumenCard label="Imp. Diferido Neto" value={resumen.impuestoDiferidoNeto} highlight />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-success">Guardado.</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar H4"}
        </Button>
      </div>
    </form>
  );
}

function Tabla({
  cats,
  rows,
  setCell,
  resumen,
}: {
  cats: typeof F2516_H4_CATEGORIAS;
  rows: Record<string, FilaState>;
  setCell: (id: string, key: keyof FilaState, val: string) => void;
  resumen: ReturnType<typeof computarH4>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <Th>#</Th>
            <Th>Categoría</Th>
            <Th align="right">Base Contable</Th>
            <Th align="right">Base Fiscal</Th>
            <Th align="right">Diferencia</Th>
            <Th align="right">Tarifa</Th>
            <Th align="right">ATD/PTD</Th>
          </tr>
        </thead>
        <tbody>
          {cats.map((cat) => {
            const fila = resumen.filas.find((f) => f.categoria.id === cat.id)!;
            return (
              <tr key={cat.id} className="border-b border-border/50" title={cat.ayuda}>
                <td className="px-2 py-1 font-mono text-xs text-muted-foreground">{cat.id}</td>
                <td className="px-2 py-1">{cat.concepto}</td>
                <td className="px-2 py-1 text-right">
                  <NumInput
                    name={`bc_${cat.id}`}
                    value={rows[cat.id]?.bc ?? ""}
                    onChange={(v) => setCell(cat.id, "bc", v)}
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <NumInput
                    name={`bf_${cat.id}`}
                    value={rows[cat.id]?.bf ?? ""}
                    onChange={(v) => setCell(cat.id, "bf", v)}
                  />
                </td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">
                  {FMT.format(fila.diferencia)}
                </td>
                <td className="px-2 py-1 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    name={`tar_${cat.id}`}
                    value={rows[cat.id]?.tarifa ?? "0.35"}
                    onChange={(e) => setCell(cat.id, "tarifa", e.target.value)}
                    className="w-20 rounded border border-border bg-background px-2 py-1 text-right text-sm"
                  />
                </td>
                <td className="px-2 py-1 text-right font-mono tabular-nums font-semibold">
                  {FMT.format(fila.impuestoDiferido)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NumInput({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      name={name}
      value={value}
      onChange={(e) => onChange(fmt(e.target.value))}
      className="w-full rounded border border-border bg-background px-2 py-1 text-right text-sm font-mono tabular-nums"
      placeholder="0"
    />
  );
}

function Section({
  title,
  ayuda,
  children,
}: {
  title: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">{ayuda}</p>
      {children}
    </section>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function ResumenCard({
  label,
  value,
  good,
  highlight,
}: {
  label: string;
  value: number;
  good?: boolean;
  highlight?: boolean;
}) {
  const cls = good
    ? "border-emerald-500/30 bg-emerald-500/5"
    : highlight
      ? "border-foreground/40 bg-amber-500/5"
      : "border-border";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-xl tabular-nums">{FMT.format(value)}</p>
    </div>
  );
}
