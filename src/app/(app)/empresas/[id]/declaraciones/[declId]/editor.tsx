"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveValoresAction, type SaveValoresState } from "./actions";

type Renglon = { numero: number; descripcion: string; seccion: string };
type Valor = { numero: number; valor: number };

const initial: SaveValoresState = { error: null, saved: 0, savedAt: null };

const FORMATTER = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function formatValor(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "";
  return FORMATTER.format(v);
}

function parseValor(s: string): number {
  const cleaned = s.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function DeclaracionEditor({
  declId,
  empresaId,
  renglones,
  valoresIniciales,
}: {
  declId: string;
  empresaId: string;
  renglones: Renglon[];
  valoresIniciales: Valor[];
}) {
  const action = saveValoresAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);

  const initialMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const v of valoresIniciales) m.set(v.numero, formatValor(Number(v.valor)));
    return m;
  }, [valoresIniciales]);

  const [valores, setValores] = useState<Map<number, string>>(initialMap);

  const renglonesPorSeccion = useMemo(() => {
    const m = new Map<string, Renglon[]>();
    for (const r of renglones) {
      const arr = m.get(r.seccion) ?? [];
      arr.push(r);
      m.set(r.seccion, arr);
    }
    return m;
  }, [renglones]);

  const totales = useMemo(() => {
    let totalIngresos = 0;
    let totalCostos = 0;
    for (const r of renglones) {
      const v = parseValor(valores.get(r.numero) ?? "");
      if (r.seccion === "Ingresos") totalIngresos += v;
      if (r.seccion === "Costos y deducciones") totalCostos += v;
    }
    return { totalIngresos, totalCostos };
  }, [renglones, valores]);

  return (
    <form action={formAction}>
      <div className="space-y-12">
        {Array.from(renglonesPorSeccion.entries()).map(([seccion, items]) => (
          <section key={seccion}>
            <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">{seccion}</h2>
            <div className="mt-4 overflow-hidden border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                      N°
                    </th>
                    <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                      Descripción
                    </th>
                    <th className="px-4 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                      Valor (COP)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.numero} className="border-t border-border">
                      <td className="px-4 py-1.5 align-top font-mono">{r.numero}</td>
                      <td className="px-4 py-1.5 align-top">{r.descripcion}</td>
                      <td className="px-2 py-1 text-right align-top">
                        <input
                          name={`v_${r.numero}`}
                          inputMode="numeric"
                          value={valores.get(r.numero) ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const cleaned = raw.replace(/[^0-9]/g, "");
                            const n = cleaned === "" ? "" : formatValor(Number(cleaned));
                            const next = new Map(valores);
                            next.set(r.numero, n);
                            setValores(next);
                          }}
                          className="h-8 w-full rounded border border-transparent bg-transparent px-2 text-right font-mono hover:border-border focus:border-ring focus:bg-card focus:outline-none"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-4 border-t border-border bg-background py-4">
        <div className="flex gap-6 text-sm">
          <p>
            <span className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Ingresos:
            </span>{" "}
            <span className="font-mono">{formatValor(totales.totalIngresos)}</span>
          </p>
          <p>
            <span className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Costos:
            </span>{" "}
            <span className="font-mono">{formatValor(totales.totalCostos)}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {!state.error && state.saved > 0 ? (
            <p className="text-sm text-muted-foreground">
              Guardados {state.saved} valores ·{" "}
              {state.savedAt ? new Date(state.savedAt).toLocaleTimeString("es-CO") : ""}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar borrador"}
          </Button>
        </div>
      </div>
    </form>
  );
}
