"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { F2516H2Fila } from "@/lib/f2516-h2-h3";
import { saveH2BulkAction, type SaveH2State } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const ESTADO: SaveH2State = { ok: false, error: null };

const DIAN_BLUE = "#1B5AAB";
const DIAN_BLUE_LIGHT = "#E8F1FA";
const TRIBAI_GOLD = "#C4952A";

function fmtN(s: string): string {
  const c = s.replace(/[^\d.\-]/g, "");
  if (!c || c === "-") return c;
  const n = Number(c);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

type Ajustes = Record<number, { conversion: string; menor: string; mayor: string }>;

export function H2FilasEditables({
  declId,
  empresaId,
  filas,
}: {
  declId: string;
  empresaId: string;
  filas: F2516H2Fila[];
}) {
  const router = useRouter();
  const action = saveH2BulkAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, ESTADO);

  // Estado inicial · cargar ajustes existentes desde props (filas con conversion/menor/mayor)
  const [ajustes, setAjustes] = useState<Ajustes>(() => {
    const init: Ajustes = {};
    for (const f of filas) {
      if (f.conversion !== 0 || f.menor_fiscal !== 0 || f.mayor_fiscal !== 0) {
        init[f.id] = {
          conversion: f.conversion ? fmtN(String(f.conversion)) : "",
          menor: f.menor_fiscal ? fmtN(String(f.menor_fiscal)) : "",
          mayor: f.mayor_fiscal ? fmtN(String(f.mayor_fiscal)) : "",
        };
      }
    }
    return init;
  });

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  function setCelda(id: number, campo: "conversion" | "menor" | "mayor", v: string) {
    setAjustes((prev) => {
      const next = { ...prev };
      const cur = next[id] ?? { conversion: "", menor: "", mayor: "" };
      next[id] = { ...cur, [campo]: fmtN(v) };
      return next;
    });
  }

  function parseN(s: string): number {
    if (!s) return 0;
    const n = Number(s.replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function fiscalCalculado(f: F2516H2Fila): number {
    const a = ajustes[f.id];
    if (!a) return f.fiscal;
    const conv = parseN(a.conversion);
    const menor = parseN(a.menor);
    const mayor = parseN(a.mayor);
    return f.contable + conv - menor + mayor;
  }

  return (
    <form action={formAction}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Edita los ajustes (Val2, Val3, Val4) inline en cada renglón. Val5 (Fiscal)
          se recalcula automáticamente. Click en <strong>Guardar</strong> para persistir.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow disabled:opacity-50"
          style={{ backgroundColor: DIAN_BLUE }}
        >
          {pending ? "Guardando…" : "💾 Guardar todos los ajustes"}
        </button>
      </div>

      {state.error ? (
        <p className="mb-3 rounded border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="mb-3 rounded border border-success/40 bg-success/5 p-2 text-sm text-success">
          ✓ Ajustes guardados.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border" style={{ borderColor: DIAN_BLUE }}>
        <table className="w-full border-collapse text-xs">
          <thead style={{ backgroundColor: DIAN_BLUE, color: "white" }}>
            <tr>
              <th className="border border-white/30 px-2 py-2 text-left">NUM</th>
              <th className="border border-white/30 px-2 py-2 text-left">Concepto</th>
              <th className="border border-white/30 px-2 py-2 text-right">Val1 · Contable</th>
              <th className="border border-white/30 px-2 py-2 text-right">Val2 · Conversión</th>
              <th className="border border-white/30 px-2 py-2 text-right">Val3 · Menor Fiscal</th>
              <th className="border border-white/30 px-2 py-2 text-right">Val4 · Mayor Fiscal</th>
              <th
                className="border border-white/30 px-2 py-2 text-right"
                style={{ backgroundColor: TRIBAI_GOLD, color: DIAN_BLUE }}
              >
                Val5 · FISCAL
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <FilaEditable
                key={f.id}
                f={f}
                ajuste={ajustes[f.id]}
                onChange={setCelda}
                fiscalCalc={fiscalCalculado(f)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-2 text-sm font-medium text-white shadow disabled:opacity-50"
          style={{ backgroundColor: DIAN_BLUE }}
        >
          {pending ? "Guardando…" : "💾 Guardar todos los ajustes"}
        </button>
      </div>
    </form>
  );
}

function FilaEditable({
  f,
  ajuste,
  onChange,
  fiscalCalc,
}: {
  f: F2516H2Fila;
  ajuste: { conversion: string; menor: string; mayor: string } | undefined;
  onChange: (id: number, campo: "conversion" | "menor" | "mayor", v: string) => void;
  fiscalCalc: number;
}) {
  const bgByNivel: Record<number, string> = {
    1: DIAN_BLUE,
    2: DIAN_BLUE_LIGHT,
    3: "transparent",
    4: "transparent",
    5: "transparent",
  };
  const colorByNivel: Record<number, string> = {
    1: "white",
    2: DIAN_BLUE,
    3: "inherit",
    4: "#666",
    5: "#888",
  };
  const isEditable = f.nivel >= 3 && !f.esTotal;
  const fontWeight = f.nivel === 1 || f.esTotal ? "bold" : "normal";
  const indent = (f.nivel - 1) * 12;

  return (
    <tr
      style={{
        backgroundColor: bgByNivel[f.nivel] ?? "transparent",
        color: colorByNivel[f.nivel] ?? "inherit",
        fontWeight,
      }}
    >
      <td className="border border-border px-2 py-1 font-mono">{f.id}</td>
      <td className="border border-border px-2 py-1" style={{ paddingLeft: indent + 8 }}>
        {f.esTotal ? "• " : ""}
        {f.concepto}
      </td>
      <td className="border border-border px-2 py-1 text-right font-mono tabular-nums">
        {f.contable === 0 ? "" : FMT.format(f.contable)}
      </td>
      <td className="border border-border p-0">
        {isEditable ? (
          <input
            type="text"
            name={`ajuste_${f.id}_conversion`}
            value={ajuste?.conversion ?? ""}
            onChange={(e) => onChange(f.id, "conversion", e.target.value)}
            className="w-full bg-transparent px-2 py-1 text-right font-mono text-xs tabular-nums focus:bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="0"
          />
        ) : (
          <span className="block px-2 py-1 text-right font-mono tabular-nums">
            {f.conversion === 0 ? "" : FMT.format(f.conversion)}
          </span>
        )}
      </td>
      <td className="border border-border p-0">
        {isEditable ? (
          <input
            type="text"
            name={`ajuste_${f.id}_menor`}
            value={ajuste?.menor ?? ""}
            onChange={(e) => onChange(f.id, "menor", e.target.value)}
            className="w-full bg-transparent px-2 py-1 text-right font-mono text-xs tabular-nums focus:bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="0"
          />
        ) : (
          <span className="block px-2 py-1 text-right font-mono tabular-nums">
            {f.menor_fiscal === 0 ? "" : FMT.format(f.menor_fiscal)}
          </span>
        )}
      </td>
      <td className="border border-border p-0">
        {isEditable ? (
          <input
            type="text"
            name={`ajuste_${f.id}_mayor`}
            value={ajuste?.mayor ?? ""}
            onChange={(e) => onChange(f.id, "mayor", e.target.value)}
            className="w-full bg-transparent px-2 py-1 text-right font-mono text-xs tabular-nums focus:bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="0"
          />
        ) : (
          <span className="block px-2 py-1 text-right font-mono tabular-nums">
            {f.mayor_fiscal === 0 ? "" : FMT.format(f.mayor_fiscal)}
          </span>
        )}
      </td>
      <td
        className="border border-border px-2 py-1 text-right font-mono tabular-nums"
        style={{
          backgroundColor: f.esTotal ? "#FFF8E1" : "transparent",
          fontWeight: f.esTotal ? "bold" : "normal",
        }}
      >
        {fiscalCalc === 0 ? "" : FMT.format(fiscalCalc)}
      </td>
    </tr>
  );
}
