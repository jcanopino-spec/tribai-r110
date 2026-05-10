"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  F2516_H5_CONCEPTOS,
  computarH5,
  type F2516H5Captura,
  type F2516H5Conciliacion,
} from "@/engine/f2516-h5";
import { saveH5Action, type SaveH5State } from "./actions";

const ESTADO: SaveH5State = { ok: false, error: null };
const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(s: string): string {
  const c = s.replace(/[^\d.\-]/g, "");
  if (!c || c === "-") return c;
  const n = Number(c);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

type FilaState = { gr: string; ex: string; exc: string; exp: string };

export function H5Form({
  declId,
  empresaId,
  initialIngresos,
  initialConciliacion,
  ingresosF110,
}: {
  declId: string;
  empresaId: string;
  initialIngresos: F2516H5Captura[];
  initialConciliacion: F2516H5Conciliacion | null;
  ingresosF110: number;
}) {
  const router = useRouter();
  const action = saveH5Action.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, ESTADO);

  const initialMap = new Map<string, F2516H5Captura>();
  for (const c of initialIngresos) initialMap.set(c.concepto_id, c);

  const [rows, setRows] = useState<Record<string, FilaState>>(() => {
    const out: Record<string, FilaState> = {};
    for (const cn of F2516_H5_CONCEPTOS) {
      const c = initialMap.get(cn.id);
      out[cn.id] = {
        gr: c ? fmt(String(c.gravados)) : "",
        ex: c ? fmt(String(c.exentos)) : "",
        exc: c ? fmt(String(c.excluidos)) : "",
        exp: c ? fmt(String(c.exportacion)) : "",
      };
    }
    return out;
  });

  const [conc, setConc] = useState({
    total_facturado_dian: initialConciliacion ? fmt(String(initialConciliacion.total_facturado_dian)) : "",
    notas_credito_emitidas: initialConciliacion ? fmt(String(initialConciliacion.notas_credito_emitidas)) : "",
    notas_debito_emitidas: initialConciliacion ? fmt(String(initialConciliacion.notas_debito_emitidas)) : "",
    observacion: initialConciliacion?.observacion ?? "",
  });

  useEffect(() => { if (state.ok) router.refresh(); }, [state, router]);

  const live = useMemo(() => {
    const capturas: F2516H5Captura[] = F2516_H5_CONCEPTOS.map((cn) => ({
      declaracion_id: declId,
      concepto_id: cn.id,
      concepto: cn.concepto,
      gravados: Number(rows[cn.id]?.gr.replace(/[^\d.\-]/g, "") || 0),
      exentos: Number(rows[cn.id]?.ex.replace(/[^\d.\-]/g, "") || 0),
      excluidos: Number(rows[cn.id]?.exc.replace(/[^\d.\-]/g, "") || 0),
      exportacion: Number(rows[cn.id]?.exp.replace(/[^\d.\-]/g, "") || 0),
      observacion: null,
    }));
    const c: F2516H5Conciliacion = {
      declaracion_id: declId,
      total_facturado_dian: Number(conc.total_facturado_dian.replace(/[^\d.\-]/g, "") || 0),
      notas_credito_emitidas: Number(conc.notas_credito_emitidas.replace(/[^\d.\-]/g, "") || 0),
      notas_debito_emitidas: Number(conc.notas_debito_emitidas.replace(/[^\d.\-]/g, "") || 0),
      observacion: null,
    };
    return computarH5(capturas, c);
  }, [rows, conc, declId]);

  const setCell = (id: string, key: keyof FilaState, val: string) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], [key]: val } }));

  const difF110 = live.ingresosBrutosNetos - ingresosF110;
  const conciliado = Math.abs(difF110) <= 1000;

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-md border border-border p-5">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Ingresos por concepto · matriz 4 tipos
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <Th>Concepto</Th>
                <Th align="right">Gravados</Th>
                <Th align="right">Exentos</Th>
                <Th align="right">Excluidos</Th>
                <Th align="right">Exportación</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {F2516_H5_CONCEPTOS.map((cn) => {
                const fila = live.filas.find((f) => f.concepto.id === cn.id)!;
                return (
                  <tr key={cn.id} className="border-b border-border/50" title={cn.ayuda}>
                    <td className="px-2 py-1">{cn.concepto}</td>
                    <td className="px-2 py-1 text-right">
                      <NumInput name={`gr_${cn.id}`} value={rows[cn.id]?.gr ?? ""} onChange={(v) => setCell(cn.id, "gr", v)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <NumInput name={`ex_${cn.id}`} value={rows[cn.id]?.ex ?? ""} onChange={(v) => setCell(cn.id, "ex", v)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <NumInput name={`exc_${cn.id}`} value={rows[cn.id]?.exc ?? ""} onChange={(v) => setCell(cn.id, "exc", v)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <NumInput name={`exp_${cn.id}`} value={rows[cn.id]?.exp ?? ""} onChange={(v) => setCell(cn.id, "exp", v)} />
                    </td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums font-semibold">
                      {FMT.format(fila.total)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-foreground bg-muted/30">
                <td className="px-2 py-2 font-semibold">TOTAL</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-bold">{FMT.format(live.totalGravados)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-bold">{FMT.format(live.totalExentos)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-bold">{FMT.format(live.totalExcluidos)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-bold">{FMT.format(live.totalExportacion)}</td>
                <td className="px-2 py-2 text-right font-mono tabular-nums font-bold">{FMT.format(live.granTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-border p-5">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Conciliación con facturación electrónica DIAN
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Total facturado (sistema DIAN)">
            <NumInput
              name="total_facturado_dian"
              value={conc.total_facturado_dian}
              onChange={(v) => setConc((c) => ({ ...c, total_facturado_dian: v }))}
            />
          </Field>
          <Field label="Notas crédito emitidas (devoluciones)">
            <NumInput
              name="notas_credito_emitidas"
              value={conc.notas_credito_emitidas}
              onChange={(v) => setConc((c) => ({ ...c, notas_credito_emitidas: v }))}
            />
          </Field>
          <Field label="Notas débito emitidas">
            <NumInput
              name="notas_debito_emitidas"
              value={conc.notas_debito_emitidas}
              onChange={(v) => setConc((c) => ({ ...c, notas_debito_emitidas: v }))}
            />
          </Field>
          <Field label="Observación">
            <Input
              name="conc_observacion"
              value={conc.observacion}
              onChange={(e) => setConc((c) => ({ ...c, observacion: e.target.value }))}
            />
          </Field>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <ResumenCard label="Gran total H5" value={live.granTotal} />
        <ResumenCard label="Ingresos netos (− NC + ND)" value={live.ingresosBrutosNetos} highlight />
        <CruceCard
          label="Cruce vs F110 (R47+R57)"
          dif={difF110}
          ok={conciliado}
          esperado={ingresosF110}
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-success">Guardado.</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar H5"}</Button>
      </div>
    </form>
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

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground ${align === "right" ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function ResumenCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
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
