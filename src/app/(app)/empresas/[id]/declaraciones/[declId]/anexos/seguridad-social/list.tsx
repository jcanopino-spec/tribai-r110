"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSegSocialAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Item = {
  id: number;
  empleado: string;
  cedula: string | null;
  salario: number;
  aporte_salud: number;
  aporte_pension: number;
  aporte_arl: number;
  aporte_parafiscales: number;
  observacion: string | null;
};

export function SegSocialList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin empleados registrados.</p>;
  }
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Empleado
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Salario
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Salud
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Pensión
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              ARL
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Parafiscales
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
        <p className="font-medium">{item.empleado}</p>
        <p className="font-mono text-xs text-muted-foreground">{item.cedula ?? "—"}</p>
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.salario)}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.aporte_salud)}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.aporte_pension)}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.aporte_arl)}</td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(item.aporte_parafiscales)}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await deleteSegSocialAction(item.id, declId, empresaId);
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
