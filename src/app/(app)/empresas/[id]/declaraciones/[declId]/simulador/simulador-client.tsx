"use client";

import { useCallback, useMemo, useState } from "react";
import { computarRenglones, type ComputeContext } from "@/engine/form110";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const c = s.replace(/[^0-9\-]/g, "");
  if (!c || c === "-") return c;
  const n = Number(c);
  return Number.isFinite(n) ? FMT.format(n) : "";
}
function parseNum(s: string): number {
  const c = String(s ?? "").replace(/[^0-9\-]/g, "");
  const n = Number(c);
  return Number.isFinite(n) ? n : 0;
}

// Variables que el usuario puede simular. Cada una corresponde a un renglón
// del 110 (o a un campo del ctx que el engine traduce a un renglón).
type VariableId =
  | "R47" // Ingresos brutos actividad ordinaria
  | "R59" // Devoluciones, rebajas y descuentos
  | "R62" // Costos
  | "R67_diff" // Otras deducciones (suma a costos)
  | "R74" // Compensaciones
  | "R76" // Renta presuntiva
  | "R77" // Rentas exentas
  | "R93" // Descuentos tributarios
  | "R107" // Total retenciones
  | "R109"; // Anticipo año anterior

type VariableDef = {
  id: VariableId;
  label: string;
  hint: string;
  /** Aplica el override del usuario al map de inputs/ctx para este renglón. */
  apply: (
    valor: number,
    inputs: Map<number, number>,
    ctx: ComputeContext,
  ) => { inputs: Map<number, number>; ctx: ComputeContext };
};

const VARIABLES: readonly VariableDef[] = [
  {
    id: "R47",
    label: "Ingresos brutos (R47)",
    hint: "Ingresos de actividades ordinarias.",
    apply: (v, inputs, ctx) => {
      const n = new Map(inputs);
      n.set(47, v);
      return { inputs: n, ctx };
    },
  },
  {
    id: "R59",
    label: "Devoluciones (R59)",
    hint: "Devoluciones, rebajas y descuentos en ventas.",
    apply: (v, inputs, ctx) => {
      const n = new Map(inputs);
      n.set(59, v);
      return { inputs: n, ctx };
    },
  },
  {
    id: "R62",
    label: "Costos (R62)",
    hint: "Costo de ventas.",
    apply: (v, inputs, ctx) => {
      const n = new Map(inputs);
      n.set(62, v);
      return { inputs: n, ctx };
    },
  },
  {
    id: "R67_diff",
    label: "Otros gastos (R63-R66)",
    hint: "Gastos operacionales y otros costos. Suma global a R63.",
    apply: (v, inputs, ctx) => {
      const n = new Map(inputs);
      n.set(63, v);
      return { inputs: n, ctx };
    },
  },
  {
    id: "R74",
    label: "Compensaciones (R74)",
    hint: "Pérdidas fiscales acumuladas a compensar.",
    apply: (v, inputs, ctx) => ({
      inputs,
      ctx: { ...ctx, totalCompensaciones: v },
    }),
  },
  {
    id: "R76",
    label: "Renta presuntiva (R76)",
    hint: "AG 2024+ usualmente 0%.",
    apply: (v, inputs, ctx) => ({
      inputs,
      ctx: { ...ctx, rentaPresuntiva: v },
    }),
  },
  {
    id: "R77",
    label: "Rentas exentas (R77)",
    hint: "Total Anexo 19.",
    apply: (v, inputs, ctx) => ({
      inputs,
      ctx: { ...ctx, totalRentasExentas: v },
    }),
  },
  {
    id: "R93",
    label: "Descuentos tributarios (R93)",
    hint: "Tope: 75% del impuesto básico (Art. 259).",
    apply: (v, inputs, ctx) => ({
      inputs,
      ctx: { ...ctx, totalDescuentosTributarios: v },
    }),
  },
  {
    id: "R107",
    label: "Retenciones (R107)",
    hint: "Total auto + otras retenciones.",
    apply: (v, inputs, ctx) => ({
      inputs,
      ctx: { ...ctx, totalRetenciones: v, totalAutorretenciones: 0 },
    }),
  },
  {
    id: "R109",
    label: "Anticipo año anterior (R109)",
    hint: "Anticipo declarado el AG anterior.",
    apply: (v, inputs, ctx) => {
      const n = new Map(inputs);
      n.set(109, v);
      return { inputs: n, ctx };
    },
  },
];

type EscenarioId = "BASE" | "A" | "B" | "C";

const ESCENARIOS: { id: EscenarioId; label: string; color: string }[] = [
  { id: "BASE", label: "Base", color: "border-border" },
  { id: "A", label: "Escenario A", color: "border-foreground/40" },
  { id: "B", label: "Escenario B", color: "border-foreground/40" },
  { id: "C", label: "Escenario C", color: "border-foreground/40" },
];

type Overrides = Partial<Record<VariableId, string>>;

export function SimuladorClient({
  inputsBase,
  ctxBase,
  renglonesBase,
}: {
  inputsBase: Record<number, number>;
  ctxBase: ComputeContext;
  renglonesBase: Record<number, number>;
}) {
  // Valores iniciales sugeridos para cada variable (vienen de la base)
  const valoresBase: Record<VariableId, number> = {
    R47: inputsBase[47] ?? 0,
    R59: inputsBase[59] ?? 0,
    R62: inputsBase[62] ?? 0,
    R67_diff: inputsBase[63] ?? 0,
    R74: ctxBase.totalCompensaciones ?? 0,
    R76: ctxBase.rentaPresuntiva ?? 0,
    R77: ctxBase.totalRentasExentas ?? 0,
    R93: ctxBase.totalDescuentosTributarios ?? 0,
    R107:
      (ctxBase.totalRetenciones ?? 0) + (ctxBase.totalAutorretenciones ?? 0),
    R109: inputsBase[109] ?? 0,
  };

  // Estado: overrides por escenario A/B/C. BASE no se edita.
  const [oA, setOA] = useState<Overrides>({});
  const [oB, setOB] = useState<Overrides>({});
  const [oC, setOC] = useState<Overrides>({});

  const calcEscenario = useCallback(
    (overrides: Overrides) => {
      const inputsMap = new Map<number, number>(
        Object.entries(inputsBase).map(([k, v]) => [Number(k), v]),
      );
      let ctx: ComputeContext = { ...ctxBase };
      for (const variable of VARIABLES) {
        const raw = overrides[variable.id];
        if (raw === undefined) continue;
        const v = parseNum(raw);
        const r = variable.apply(v, inputsMap, ctx);
        ctx = r.ctx;
        for (const [k, val] of r.inputs) inputsMap.set(k, val);
      }
      return computarRenglones(inputsMap, ctx);
    },
    [inputsBase, ctxBase],
  );

  const numA = useMemo(() => calcEscenario(oA), [oA, calcEscenario]);
  const numB = useMemo(() => calcEscenario(oB), [oB, calcEscenario]);
  const numC = useMemo(() => calcEscenario(oC), [oC, calcEscenario]);

  const baseSaldoPagar = renglonesBase[113] ?? 0;
  const baseSaldoFavor = renglonesBase[114] ?? 0;

  const escenarioData = (
    n: Map<number, number> | Record<number, number>,
  ): {
    rentaLiq: number;
    impNeto: number;
    saldoPagar: number;
    saldoFavor: number;
  } => {
    const get = (k: number): number =>
      n instanceof Map ? n.get(k) ?? 0 : (n[k] ?? 0);
    return {
      rentaLiq: get(79),
      impNeto: get(94),
      saldoPagar: get(113),
      saldoFavor: get(114),
    };
  };

  const dBase = escenarioData(renglonesBase);
  const dA = escenarioData(numA);
  const dB = escenarioData(numB);
  const dC = escenarioData(numC);

  function diffSaldo(esc: { saldoPagar: number; saldoFavor: number }): number {
    const escNeto = esc.saldoPagar - esc.saldoFavor;
    const baseNeto = baseSaldoPagar - baseSaldoFavor;
    return escNeto - baseNeto;
  }

  function setOverride(
    setter: (o: Overrides) => void,
    current: Overrides,
    id: VariableId,
    rawString: string,
  ) {
    setter({ ...current, [id]: rawString });
  }

  function resetEscenario(setter: (o: Overrides) => void) {
    setter({});
  }

  function copyFromBase(
    setter: (o: Overrides) => void,
    current: Overrides,
  ) {
    const next: Overrides = { ...current };
    for (const v of VARIABLES) {
      next[v.id] = FMT.format(valoresBase[v.id]);
    }
    setter(next);
  }

  return (
    <div className="mt-8">
      {/* Acciones por escenario */}
      <div className="mb-3 grid gap-3 md:grid-cols-4">
        <div></div>
        {[
          { id: "A", o: oA, set: setOA },
          { id: "B", o: oB, set: setOB },
          { id: "C", o: oC, set: setOC },
        ].map((e) => (
          <div key={e.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyFromBase(e.set, e.o)}
              className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
            >
              ↩ desde base
            </button>
            <button
              type="button"
              onClick={() => resetEscenario(e.set)}
              className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
            >
              ✕ limpiar
            </button>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-foreground text-left">
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Variable
              </th>
              {ESCENARIOS.map((e) => (
                <th
                  key={e.id}
                  className={`px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] ${
                    e.id === "BASE" ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {e.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VARIABLES.map((v) => (
              <tr key={v.id} className="border-b border-border">
                <td className="px-2 py-1.5 text-sm">
                  {v.label}
                  <p className="text-[10px] text-muted-foreground">{v.hint}</p>
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {FMT.format(valoresBase[v.id])}
                </td>
                {[
                  { o: oA, set: setOA },
                  { o: oB, set: setOB },
                  { o: oC, set: setOC },
                ].map((e, idx) => (
                  <td key={idx} className="px-2 py-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={e.o[v.id] ?? ""}
                      onChange={(ev) =>
                        setOverride(e.set, e.o, v.id, fmtInput(ev.target.value))
                      }
                      placeholder={FMT.format(valoresBase[v.id])}
                      className="w-full bg-transparent text-right font-mono text-xs tabular-nums outline-none focus:bg-muted/40 px-1"
                    />
                  </td>
                ))}
              </tr>
            ))}
            {/* RESULTADOS */}
            <tr>
              <td colSpan={5} className="bg-foreground/[0.04] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground">
                Resultados
              </td>
            </tr>
            <ResultadoRow
              label="Renta líquida gravable (R79)"
              base={dBase.rentaLiq}
              a={dA.rentaLiq}
              b={dB.rentaLiq}
              c={dC.rentaLiq}
            />
            <ResultadoRow
              label="Impuesto neto de renta (R94)"
              base={dBase.impNeto}
              a={dA.impNeto}
              b={dB.impNeto}
              c={dC.impNeto}
            />
            <ResultadoRow
              label="Saldo a pagar (R113)"
              base={dBase.saldoPagar}
              a={dA.saldoPagar}
              b={dB.saldoPagar}
              c={dC.saldoPagar}
            />
            <ResultadoRow
              label="Saldo a favor (R114)"
              base={dBase.saldoFavor}
              a={dA.saldoFavor}
              b={dB.saldoFavor}
              c={dC.saldoFavor}
            />
            <tr className="border-t-2 border-foreground bg-muted/30 text-sm font-semibold">
              <td className="px-2 py-2">Δ vs Base (saldo neto)</td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">
                0
              </td>
              <DeltaTd v={diffSaldo(dA)} />
              <DeltaTd v={diffSaldo(dB)} />
              <DeltaTd v={diffSaldo(dC)} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Cómo funciona</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            La columna <span className="font-medium">Base</span> muestra los valores
            actuales de la declaración (no se editan aquí).
          </li>
          <li>
            En cada escenario A/B/C captura los valores que quieres simular. Si dejas
            un campo vacío, el simulador usa el valor de la base.
          </li>
          <li>
            El motor recalcula <em>todos</em> los renglones del 110 con tus inputs:
            tarifa, TTD, sobretasa, anticipo, sanciones, redondeo DIAN, etc.
          </li>
          <li>
            La fila <span className="font-medium">Δ vs Base</span> muestra cuánto cambia
            el saldo neto (pagar − favor) respecto a la base. Negativo = ahorro fiscal.
          </li>
          <li>
            Los cambios <span className="font-medium">NO se guardan</span> en la
            declaración. Es planeación, no edición.
          </li>
        </ol>
      </div>
    </div>
  );
}

function ResultadoRow({
  label,
  base,
  a,
  b,
  c,
}: {
  label: string;
  base: number;
  a: number;
  b: number;
  c: number;
}) {
  return (
    <tr className="border-b border-border text-sm">
      <td className="px-2 py-1.5 font-medium">{label}</td>
      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
        {FMT.format(base)}
      </td>
      <ResultadoTd v={a} base={base} />
      <ResultadoTd v={b} base={base} />
      <ResultadoTd v={c} base={base} />
    </tr>
  );
}

function ResultadoTd({ v, base }: { v: number; base: number }) {
  const diff = v - base;
  const cls =
    diff === 0
      ? ""
      : diff > 0
        ? "text-destructive"
        : "text-success";
  return (
    <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${cls}`}>
      {FMT.format(v)}
    </td>
  );
}

function DeltaTd({ v }: { v: number }) {
  const cls =
    v === 0 ? "text-muted-foreground" : v > 0 ? "text-destructive" : "text-success";
  return (
    <td className={`px-2 py-2 text-right font-mono tabular-nums ${cls}`}>
      {v > 0 ? "+" : ""}
      {FMT.format(v)}
    </td>
  );
}
