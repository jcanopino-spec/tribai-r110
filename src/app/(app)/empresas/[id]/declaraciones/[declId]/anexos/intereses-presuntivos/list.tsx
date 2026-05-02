"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInteresAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Item = {
  id: number;
  socio: string;
  cuenta: string | null;
  saldo_promedio: number;
  dias: number;
  interes_registrado: number;
  interesPresunto: number;
  diferencia: number;
  observacion: string | null;
};

export function InteresList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin préstamos registrados.</p>;
  }

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Socio / Cuenta
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Saldo
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Días
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Interés presunto
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Interés registrado
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Diferencia
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
        {item.cuenta ? (
          <p className="font-mono text-xs text-muted-foreground">{item.cuenta}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.saldo_promedio)}</td>
      <td className="px-3 py-2 text-right font-mono">{item.dias}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.interesPresunto)}</td>
      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
        {FMT.format(item.interes_registrado)}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono font-medium ${
          item.diferencia > 0 ? "text-destructive" : ""
        }`}
      >
        {FMT.format(item.diferencia)}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await deleteInteresAction(item.id, declId, empresaId);
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
