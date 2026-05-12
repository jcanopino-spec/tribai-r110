"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { F2516H3Fila } from "@/lib/f2516-h2-h3";
import { saveH3BulkAction, type SaveH3State } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const ESTADO: SaveH3State = { ok: false, error: null };

const DIAN_BLUE = "#1B5AAB";
const DIAN_BLUE_LIGHT = "#E8F1FA";
const TRIBAI_GOLD = "#C4952A";

function fmtN(s: string): string {
  const c = s.replace(/[^\d.\-]/g, "");
  if (!c || c === "-") return c;
  const n = Number(c);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

type Ajuste = {
  conversion: string;
  menor: string;
  mayor: string;
  rl_gen: string;
  rl_zf: string;
  rl_div: string;
  rl_go: string;
};

const EMPTY: Ajuste = {
  conversion: "", menor: "", mayor: "",
  rl_gen: "", rl_zf: "", rl_div: "", rl_go: "",
};

export function H3FilasEditables({
  declId,
  empresaId,
  filas,
}: {
  declId: string;
  empresaId: string;
  filas: F2516H3Fila[];
}) {
  const router = useRouter();
  const action = saveH3BulkAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, ESTADO);

  const [ajustes, setAjustes] = useState<Record<number, Ajuste>>(() => {
    const init: Record<number, Ajuste> = {};
    for (const f of filas) {
      const tieneAjuste =
        f.conversion !== 0 ||
        f.menor_fiscal !== 0 ||
        f.mayor_fiscal !== 0 ||
        f.rl_tarifa_general !== 0 ||
        f.rl_zf !== 0 ||
        f.rl_dividendos !== 0 ||
        f.rl_go !== 0;
      if (tieneAjuste) {
        init[f.id] = {
          conversion: f.conversion ? fmtN(String(f.conversion)) : "",
          menor: f.menor_fiscal ? fmtN(String(f.menor_fiscal)) : "",
          mayor: f.mayor_fiscal ? fmtN(String(f.mayor_fiscal)) : "",
          rl_gen: f.rl_tarifa_general ? fmtN(String(f.rl_tarifa_general)) : "",
          rl_zf: f.rl_zf ? fmtN(String(f.rl_zf)) : "",
          rl_div: f.rl_dividendos ? fmtN(String(f.rl_dividendos)) : "",
          rl_go: f.rl_go ? fmtN(String(f.rl_go)) : "",
        };
      }
    }
    return init;
  });

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  function setCelda(id: number, campo: keyof Ajuste, v: string) {
    setAjustes((prev) => {
      const next = { ...prev };
      const cur = next[id] ?? { ...EMPTY };
      next[id] = { ...cur, [campo]: fmtN(v) };
      return next;
    });
  }

  function parseN(s: string): number {
    if (!s) return 0;
    const n = Number(s.replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function fiscalCalc(f: F2516H3Fila): number {
    const a = ajustes[f.id];
    if (!a) return f.fiscal;
    return f.contable + parseN(a.conversion) - parseN(a.menor) + parseN(a.mayor);
  }

  return (
    <form action={formAction}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Edita los ajustes inline. Val5 (Fiscal) y RL por tarifa se recalculan.
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
        <table className="w-full border-collapse text-[11px]">
          <thead style={{ backgroundColor: DIAN_BLUE, color: "white" }}>
            <tr>
              <th className="border border-white/30 px-1 py-2 text-left">NUM</th>
              <th className="border border-white/30 px-1 py-2 text-left">Concepto</th>
              <th className="border border-white/30 px-1 py-2 text-right">Val1 · Contable</th>
              <th className="border border-white/30 px-1 py-2 text-right">Val2 · Conv</th>
              <th className="border border-white/30 px-1 py-2 text-right">Val3 · Menor</th>
              <th className="border border-white/30 px-1 py-2 text-right">Val4 · Mayor</th>
              <th
                className="border border-white/30 px-1 py-2 text-right"
                style={{ backgroundColor: TRIBAI_GOLD, color: DIAN_BLUE }}
              >
                Val5 · FISCAL
              </th>
              <th className="border border-white/30 px-1 py-2 text-right">RL Gen</th>
              <th className="border border-white/30 px-1 py-2 text-right">RL ZF</th>
              <th className="border border-white/30 px-1 py-2 text-right">RL Div</th>
              <th className="border border-white/30 px-1 py-2 text-right">RL GO</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <FilaH3Editable
                key={f.id}
                f={f}
                ajuste={ajustes[f.id]}
                onChange={setCelda}
                fiscal={fiscalCalc(f)}
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

function FilaH3Editable({
  f,
  ajuste,
  onChange,
  fiscal,
}: {
  f: F2516H3Fila;
  ajuste: Ajuste | undefined;
  onChange: (id: number, campo: keyof Ajuste, v: string) => void;
  fiscal: number;
}) {
  const bgByNivel: Record<number, string> = {
    1: DIAN_BLUE,
    2: DIAN_BLUE_LIGHT,
    3: "transparent",
    4: "transparent",
    5: "transparent",
    6: "transparent",
  };
  const colorByNivel: Record<number, string> = {
    1: "white",
    2: DIAN_BLUE,
    3: "inherit",
    4: "#555",
    5: "#777",
    6: "#999",
  };
  const isEditable = f.nivel >= 3 && !f.esTotal;
  const fontWeight = f.nivel === 1 || f.esTotal ? "bold" : "normal";
  const indent = (f.nivel - 1) * 8;
  const a = ajuste ?? EMPTY;

  function Cell({ campo, value }: { campo: keyof Ajuste; value: number }) {
    if (isEditable) {
      return (
        <td className="border border-border p-0">
          <input
            type="text"
            name={`ajuste_${f.id}_${campo}`}
            value={a[campo]}
            onChange={(e) => onChange(f.id, campo, e.target.value)}
            className="w-full bg-transparent px-1 py-0.5 text-right font-mono text-xs tabular-nums focus:bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="0"
          />
        </td>
      );
    }
    return (
      <td className="border border-border px-1 py-0.5 text-right font-mono tabular-nums">
        {value === 0 ? "" : FMT.format(value)}
      </td>
    );
  }

  return (
    <tr
      style={{
        backgroundColor: bgByNivel[f.nivel] ?? "transparent",
        color: colorByNivel[f.nivel] ?? "inherit",
        fontWeight,
      }}
    >
      <td className="border border-border px-1 py-0.5 font-mono">{f.id}</td>
      <td className="border border-border px-1 py-0.5" style={{ paddingLeft: indent + 4 }}>
        {f.esTotal ? "• " : ""}
        {f.concepto}
      </td>
      <td className="border border-border px-1 py-0.5 text-right font-mono tabular-nums">
        {f.contable === 0 ? "" : FMT.format(f.contable)}
      </td>
      <Cell campo="conversion" value={f.conversion} />
      <Cell campo="menor" value={f.menor_fiscal} />
      <Cell campo="mayor" value={f.mayor_fiscal} />
      <td
        className="border border-border px-1 py-0.5 text-right font-mono tabular-nums"
        style={{
          backgroundColor: f.esTotal ? "#FFF8E1" : "transparent",
          fontWeight: "bold",
        }}
      >
        {fiscal === 0 ? "" : FMT.format(fiscal)}
      </td>
      <Cell campo="rl_gen" value={f.rl_tarifa_general} />
      <Cell campo="rl_zf" value={f.rl_zf} />
      <Cell campo="rl_div" value={f.rl_dividendos} />
      <Cell campo="rl_go" value={f.rl_go} />
    </tr>
  );
}
