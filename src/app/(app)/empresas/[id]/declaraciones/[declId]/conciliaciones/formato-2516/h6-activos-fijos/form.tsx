"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  F2516_H6_CATEGORIAS,
  computarH6,
  type F2516H6Captura,
} from "@/engine/f2516-h6";
import { saveH6Action, type SaveH6State } from "./actions";

const ESTADO: SaveH6State = { ok: false, error: null };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const c = s.replace(/[^\d.\-]/g, "");
  if (!c || c === "-") return c;
  const n = Number(c);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

type Fila = {
  si: string;
  ad: string;
  re: string;
  dac: string;
  dan: string;
  af: string;
};

export function H6Form({
  declId,
  empresaId,
  initial,
  r40r42F110,
}: {
  declId: string;
  empresaId: string;
  initial: F2516H6Captura[];
  r40r42F110: number;
}) {
  const router = useRouter();
  const action = saveH6Action.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, ESTADO);

  const initialMap = new Map<string, F2516H6Captura>();
  for (const c of initial) initialMap.set(c.categoria_id, c);

  const [rows, setRows] = useState<Record<string, Fila>>(() => {
    const out: Record<string, Fila> = {};
    for (const cat of F2516_H6_CATEGORIAS) {
      const c = initialMap.get(cat.id);
      out[cat.id] = {
        si: c ? fmt(String(c.saldo_inicial)) : "",
        ad: c ? fmt(String(c.adiciones)) : "",
        re: c ? fmt(String(c.retiros)) : "",
        dac: c ? fmt(String(c.deprec_acumulada)) : "",
        dan: c ? fmt(String(c.deprec_ano)) : "",
        af: c ? fmt(String(c.ajuste_fiscal)) : "",
      };
    }
    return out;
  });

  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);

  const live = useMemo(() => {
    const capturas: F2516H6Captura[] = F2516_H6_CATEGORIAS.map((cat) => ({
      declaracion_id: declId,
      categoria_id: cat.id,
      categoria: cat.categoria,
      saldo_inicial: Number(rows[cat.id]?.si.replace(/[^\d.\-]/g, "") || 0),
      adiciones: Number(rows[cat.id]?.ad.replace(/[^\d.\-]/g, "") || 0),
      retiros: Number(rows[cat.id]?.re.replace(/[^\d.\-]/g, "") || 0),
      deprec_acumulada: Number(rows[cat.id]?.dac.replace(/[^\d.\-]/g, "") || 0),
      deprec_ano: Number(rows[cat.id]?.dan.replace(/[^\d.\-]/g, "") || 0),
      ajuste_fiscal: Number(rows[cat.id]?.af.replace(/[^\d.\-]/g, "") || 0),
      observacion: null,
    }));
    return computarH6(capturas);
  }, [rows, declId]);

  const setCell = (id: string, key: keyof Fila, val: string) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], [key]: val } }));

  const ppe = F2516_H6_CATEGORIAS.filter((c) => c.tipo === "ppe");
  const intangibles = F2516_H6_CATEGORIAS.filter((c) => c.tipo === "intangible");
  const difContable = live.totalContable - r40r42F110;
  const ok = Math.abs(difContable) <= 1000;

  return (
    <form action={formAction} className="space-y-8">
      <Section title="Propiedad, Planta y Equipo" ayuda="Alimenta R42 del F110">
        <Tabla cats={ppe} rows={rows} setCell={setCell} live={live} />
      </Section>
      <Section title="Intangibles" ayuda="Alimenta R40 del F110">
        <Tabla cats={intangibles} rows={rows} setCell={setCell} live={live} />
      </Section>

      <div className="grid gap-3 md:grid-cols-3">
        <Card label="Total contable" value={live.totalContable} />
        <Card label="Total fiscal" value={live.totalFiscal} highlight />
        <CruceCard label="vs R40+R42 F110" dif={difContable} ok={ok} esperado={r40r42F110} />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-success">Guardado.</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar H6"}</Button>
      </div>
    </form>
  );
}

function Tabla({
  cats,
  rows,
  setCell,
  live,
}: {
  cats: typeof F2516_H6_CATEGORIAS;
  rows: Record<string, Fila>;
  setCell: (id: string, key: keyof Fila, val: string) => void;
  live: ReturnType<typeof computarH6>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <Th>Categoría</Th>
            <Th align="right">SI Costo</Th>
            <Th align="right">Adiciones</Th>
            <Th align="right">Retiros</Th>
            <Th align="right">Deprec Acum</Th>
            <Th align="right">Deprec Año</Th>
            <Th align="right">SF Neto</Th>
            <Th align="right">Ajuste Fiscal</Th>
            <Th align="right">SF Fiscal</Th>
          </tr>
        </thead>
        <tbody>
          {cats.map((cat) => {
            const fila = live.filas.find((f) => f.categoria.id === cat.id)!;
            return (
              <tr key={cat.id} className="border-b border-border/50" title={cat.ayuda}>
                <td className="px-2 py-1">{cat.categoria}</td>
                <td className="px-2 py-1 text-right">
                  <NumInput name={`si_${cat.id}`} value={rows[cat.id]?.si ?? ""} onChange={(v) => setCell(cat.id, "si", v)} />
                </td>
                <td className="px-2 py-1 text-right">
                  <NumInput name={`ad_${cat.id}`} value={rows[cat.id]?.ad ?? ""} onChange={(v) => setCell(cat.id, "ad", v)} />
                </td>
                <td className="px-2 py-1 text-right">
                  <NumInput name={`re_${cat.id}`} value={rows[cat.id]?.re ?? ""} onChange={(v) => setCell(cat.id, "re", v)} />
                </td>
                <td className="px-2 py-1 text-right">
                  <NumInput name={`dac_${cat.id}`} value={rows[cat.id]?.dac ?? ""} onChange={(v) => setCell(cat.id, "dac", v)} />
                </td>
                <td className="px-2 py-1 text-right">
                  <NumInput name={`dan_${cat.id}`} value={rows[cat.id]?.dan ?? ""} onChange={(v) => setCell(cat.id, "dan", v)} />
                </td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">{FMT.format(fila.sfNetoContable)}</td>
                <td className="px-2 py-1 text-right">
                  <NumInput name={`af_${cat.id}`} value={rows[cat.id]?.af ?? ""} onChange={(v) => setCell(cat.id, "af", v)} />
                </td>
                <td className="px-2 py-1 text-right font-mono tabular-nums font-semibold">{FMT.format(fila.sfFiscal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NumInput({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
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

function Section({ title, ayuda, children }: { title: string; ayuda: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
      <p className="mb-4 text-xs text-muted-foreground">{ayuda}</p>
      {children}
    </section>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground ${align === "right" ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Card({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? "border-foreground/40 bg-amber-500/5" : "border-border"}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-xl tabular-nums">{FMT.format(value)}</p>
    </div>
  );
}

function CruceCard({ label, dif, ok, esperado }: { label: string; dif: number; ok: boolean; esperado: number }) {
  const cls = ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-xl tabular-nums">{ok ? "✓ Conciliado" : `Δ ${FMT.format(dif)}`}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">F110: {FMT.format(esperado)}</p>
    </div>
  );
}
