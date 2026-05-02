"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDividendoAction } from "./actions";
import { CATEGORIAS } from "./consts";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

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
  const [pending, start] = useTransition();
  const total = CATEGORIAS.reduce((s, c) => s + Number(item[c.id] ?? 0), 0);
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
      </td>
    </tr>
  );
}
