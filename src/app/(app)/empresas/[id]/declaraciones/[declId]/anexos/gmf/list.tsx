"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGmfAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Item = {
  id: number;
  entidad: string;
  periodo: string | null;
  valor_gmf: number;
  observacion: string | null;
};

export function GmfList({
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
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Entidad
            </th>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Período
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Valor GMF
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
        <p className="font-medium">{item.entidad}</p>
        {item.observacion ? (
          <p className="text-xs text-muted-foreground">{item.observacion}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-sm text-muted-foreground">{item.periodo ?? "—"}</td>
      <td className="px-3 py-2 text-right font-mono font-medium">
        {FMT.format(item.valor_gmf)}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await deleteGmfAction(item.id, declId, empresaId);
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
