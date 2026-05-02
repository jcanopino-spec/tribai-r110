"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDivDistAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Item = {
  id: number;
  socio: string;
  nit: string | null;
  participacion_pct: number;
  dividendo_no_gravado: number;
  dividendo_gravado: number;
  retencion_aplicable: number;
  observacion: string | null;
};

export function DivDistList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin socios registrados.</p>;
  }
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Socio / NIT
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Part.
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              No gravado
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Gravado
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Retención
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

function Row({ item, declId, empresaId }: { item: Item; declId: string; empresaId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.socio}</p>
        <p className="font-mono text-xs text-muted-foreground">{item.nit ?? "—"}</p>
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {Number(item.participacion_pct).toFixed(2)}%
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(item.dividendo_no_gravado)}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(item.dividendo_gravado)}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(item.retencion_aplicable)}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await deleteDivDistAction(item.id, declId, empresaId);
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
