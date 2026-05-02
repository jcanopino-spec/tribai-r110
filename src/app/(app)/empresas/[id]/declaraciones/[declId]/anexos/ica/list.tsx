"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteIcaAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Item = {
  id: number;
  municipio: string;
  base_gravable: number;
  tarifa_milaje: number;
  valor_pagado: number;
  observacion: string | null;
};

export function IcaList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>;
  }
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Municipio
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Base
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Tarifa ‰
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Pagado
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
        <p className="font-medium">{item.municipio}</p>
        {item.observacion ? (
          <p className="text-xs text-muted-foreground">{item.observacion}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.base_gravable)}</td>
      <td className="px-3 py-2 text-right font-mono">{Number(item.tarifa_milaje).toFixed(2)}</td>
      <td className="px-3 py-2 text-right font-mono font-medium">
        {FMT.format(item.valor_pagado)}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await deleteIcaAction(item.id, declId, empresaId);
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
