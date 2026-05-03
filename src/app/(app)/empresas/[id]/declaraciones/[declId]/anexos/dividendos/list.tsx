"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteDividendoAction, updateDividendoAction } from "./actions";
import { CATEGORIAS } from "./consts";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const c = s.replace(/[^0-9]/g, "");
  return c ? FMT.format(Number(c)) : "";
}
function parseNum(s: string): number {
  const c = String(s ?? "").replace(/[^0-9]/g, "");
  const n = Number(c);
  return Number.isFinite(n) ? n : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = any;

export function DividendoList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin dividendos registrados.</p>;
  }

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[1200px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              NIT / Tercero
            </th>
            {CATEGORIAS.map((c) => (
              <th
                key={c.id}
                className="px-2 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground"
              >
                R{c.renglon}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Total
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <Row key={it.id} item={it} declId={declId} empresaId={empresaId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  item,
  declId,
  empresaId,
}: {
  item: Item;
  declId: string;
  empresaId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [tercero, setTercero] = useState(item.tercero);
  const [nit, setNit] = useState(item.nit ?? "");
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of CATEGORIAS) {
      const v = Number(item[c.id] ?? 0);
      init[c.id] = v ? FMT.format(v) : "";
    }
    return init;
  });

  const total = CATEGORIAS.reduce((s, c) => s + Number(item[c.id] ?? 0), 0);

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input value={tercero} onChange={(e) => setTercero(e.target.value)} className="text-xs" />
          <Input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="NIT" className="mt-1 font-mono text-xs" />
        </td>
        {CATEGORIAS.map((c) => (
          <td key={c.id} className="px-2 py-2">
            <Input
              value={valores[c.id]}
              onChange={(e) =>
                setValores({ ...valores, [c.id]: fmtInput(e.target.value) })
              }
              inputMode="numeric"
              className="text-right font-mono text-xs"
            />
          </td>
        ))}
        <td className="px-3 py-2 text-right text-xs text-muted-foreground">—</td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await updateDividendoAction(item.id, declId, empresaId, {
                    nit: nit || null,
                    tercero,
                    no_constitutivos: parseNum(valores.no_constitutivos),
                    distribuidos_no_residentes: parseNum(valores.distribuidos_no_residentes),
                    gravados_tarifa_general: parseNum(valores.gravados_tarifa_general),
                    gravados_persona_natural_dos: parseNum(valores.gravados_persona_natural_dos),
                    gravados_personas_extranjeras: parseNum(valores.gravados_personas_extranjeras),
                    gravados_art_245: parseNum(valores.gravados_art_245),
                    gravados_tarifa_l1819: parseNum(valores.gravados_tarifa_l1819),
                    gravados_proyectos: parseNum(valores.gravados_proyectos),
                  });
                  setEditing(false);
                  router.refresh();
                })
              }
              className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTercero(item.tercero);
                setNit(item.nit ?? "");
                const init: Record<string, string> = {};
                for (const c of CATEGORIAS) {
                  const v = Number(item[c.id] ?? 0);
                  init[c.id] = v ? FMT.format(v) : "";
                }
                setValores(init);
                setEditing(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.tercero}</p>
        {item.nit ? (
          <p className="font-mono text-xs text-muted-foreground">{item.nit}</p>
        ) : null}
      </td>
      {CATEGORIAS.map((c) => {
        const v = Number(item[c.id] ?? 0);
        return (
          <td
            key={c.id}
            className={`px-2 py-2 text-right font-mono ${v === 0 ? "text-muted-foreground" : ""}`}
          >
            {v === 0 ? "—" : FMT.format(v)}
          </td>
        );
      })}
      <td className="px-3 py-2 text-right font-mono font-medium">{FMT.format(total)}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Modificar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              start(async () => {
                await deleteDividendoAction(item.id, declId, empresaId);
                router.refresh();
              });
            }}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            {pending ? "…" : "Eliminar"}
          </button>
        </div>
      </td>
    </tr>
  );
}
