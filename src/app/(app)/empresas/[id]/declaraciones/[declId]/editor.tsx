"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import {
  saveValoresAction,
  saveDatosAnticipoAction,
  type SaveValoresState,
} from "./actions";
import {
  RENGLONES_COMPUTADOS,
  FORMULAS_LEYENDA,
  computarRenglones,
  normalizarSigno,
} from "@/lib/forms/form110-compute";

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

type AniosDeclarando = "primero" | "segundo" | "tercero_o_mas";

export function DeclaracionEditor({
  declId,
  empresaId,
  renglones,
  valoresIniciales,
  tarifaRegimen,
  impuestoNetoAnterior,
  aniosDeclarando,
}: {
  declId: string;
  empresaId: string;
  renglones: Renglon[];
  valoresIniciales: Valor[];
  tarifaRegimen: number | null;
  impuestoNetoAnterior: number;
  aniosDeclarando: AniosDeclarando;
}) {
  const action = saveValoresAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);

  // Mapa de inputs (excluye computados) — los computados se derivan en cada render.
  // Aplicamos normalizarSigno por seguridad: aunque DB ya esté normalizada,
  // garantizamos que ningún renglón positivo se muestre con signo negativo.
  const initialMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const v of valoresIniciales) {
      if (RENGLONES_COMPUTADOS.has(v.numero)) continue;
      m.set(v.numero, formatValor(normalizarSigno(v.numero, Number(v.valor))));
    }
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

  // Datos del anticipo (renglón 108): año anterior + años declarando.
  const [impAnterior, setImpAnterior] = useState(formatValor(impuestoNetoAnterior));
  const [anios, setAnios] = useState<AniosDeclarando>(aniosDeclarando);
  const [savingAnticipo, startAnticipo] = useTransition();
  const [anticipoSaved, setAnticipoSaved] = useState<string | null>(null);

  // Numérico actual: combina inputs (en string) con derivados (calculados).
  const numerico = useMemo(() => {
    const base = new Map<number, number>();
    for (const [num, str] of valores) base.set(num, parseValor(str));
    return computarRenglones(base, {
      tarifaRegimen: tarifaRegimen ?? undefined,
      impuestoNetoAnterior: parseValor(impAnterior),
      aniosDeclarando: anios,
    });
  }, [valores, tarifaRegimen, impAnterior, anios]);

  function guardarAnticipo() {
    startAnticipo(async () => {
      await saveDatosAnticipoAction(declId, empresaId, {
        impuestoNetoAnterior: parseValor(impAnterior),
        aniosDeclarando: anios,
      });
      setAnticipoSaved(`Guardado · ${new Date().toLocaleTimeString("es-CO")}`);
    });
  }

  const totales = useMemo(() => {
    return {
      patrimonioBruto: numerico.get(44) ?? 0,
      patrimonioLiquido: numerico.get(46) ?? 0,
      ingresosBrutos: numerico.get(58) ?? 0,
      ingresosNetos: numerico.get(61) ?? 0,
      totalCostos: numerico.get(67) ?? 0,
    };
  }, [numerico]);

  return (
    <form action={formAction}>
      <section className="mb-10 border border-border p-5">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          Datos para el anticipo · renglón 108
        </p>
        <h3 className="mt-2 font-serif text-xl leading-[1.1]">
          Cómo calcular el anticipo del año siguiente
        </h3>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Impuesto neto AG anterior (2024)">
            <Input
              inputMode="numeric"
              value={impAnterior}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, "");
                setImpAnterior(cleaned === "" ? "" : formatValor(Number(cleaned)));
              }}
              placeholder="0"
            />
          </Field>
          <Field label="Años declarando">
            <Select value={anios} onChange={(e) => setAnios(e.target.value as AniosDeclarando)}>
              <option value="primero">Primer año (no aplica anticipo)</option>
              <option value="segundo">Segundo año (50%)</option>
              <option value="tercero_o_mas">Tercer año o más (75%)</option>
            </Select>
          </Field>
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={guardarAnticipo}
              disabled={savingAnticipo}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted disabled:opacity-50"
            >
              {savingAnticipo ? "Guardando…" : "Guardar"}
            </button>
            {anticipoSaved ? (
              <p className="text-xs text-muted-foreground">{anticipoSaved}</p>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Anticipo (108) = max(0, ((96 + impuesto AG anterior) / 2 × tarifa) − retenciones).
          Tarifa: 25% / 50% / 75% según años declarando.
        </p>
      </section>

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
                  {items.map((r) => {
                    const isComputado = RENGLONES_COMPUTADOS.has(r.numero);
                    const valor = isComputado
                      ? numerico.get(r.numero) ?? 0
                      : valores.get(r.numero) ?? "";
                    return (
                      <tr
                        key={r.numero}
                        className={`border-t border-border ${isComputado ? "bg-muted/30" : ""}`}
                      >
                        <td className="px-4 py-1.5 align-top font-mono">{r.numero}</td>
                        <td className="px-4 py-1.5 align-top">
                          {r.descripcion}
                          {isComputado ? (
                            <span className="ml-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                              · {FORMULAS_LEYENDA[r.numero] ?? "calculado"}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          {isComputado ? (
                            <p className="px-2 py-1.5 font-mono font-medium">
                              {formatValor(Number(valor))}
                            </p>
                          ) : (
                            <input
                              name={`v_${r.numero}`}
                              inputMode="numeric"
                              value={valor as string}
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
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border bg-background py-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <ResumenItem label="Patrimonio bruto" value={totales.patrimonioBruto} />
          <ResumenItem label="Patrimonio líquido" value={totales.patrimonioLiquido} />
          <ResumenItem label="Ingresos brutos" value={totales.ingresosBrutos} />
          <ResumenItem label="Ingresos netos" value={totales.ingresosNetos} />
          <ResumenItem label="Total costos" value={totales.totalCostos} />
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

function ResumenItem({ label, value }: { label: string; value: number }) {
  return (
    <p>
      <span className="font-mono uppercase tracking-[0.05em] text-muted-foreground">{label}:</span>{" "}
      <span className="font-mono">{FORMATTER.format(value)}</span>
    </p>
  );
}
