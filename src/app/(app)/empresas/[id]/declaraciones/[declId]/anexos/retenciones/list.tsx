"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRetencionAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Item = {
  id: number;
  tipo: string;
  concepto: string;
  agente: string | null;
  nit: string | null;
  base: number;
  retenido: number;
};

export function RetencionList({
  retenciones,
  autorretenciones,
  declId,
  empresaId,
}: {
  retenciones: Item[];
  autorretenciones: Item[];
  declId: string;
  empresaId: string;
}) {
  return (
    <div className="space-y-10">
      <Section
        title="Retenciones (suman a renglón 106)"
        items={retenciones}
        declId={declId}
        empresaId={empresaId}
      />
      <Section
        title="Autorretenciones (suman a renglón 105)"
        items={autorretenciones}
        declId={declId}
        empresaId={empresaId}
      />
    </div>
  );
}

function Section({
  title,
  items,
  declId,
  empresaId,
}: {
  title: string;
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  return (
    <section>
      <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin líneas registradas.</p>
      ) : (
        <div className="mt-4 overflow-x-auto border border-border">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  Concepto
                </th>
                <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  Agente / NIT
                </th>
                <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  Base
                </th>
                <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  Retenido
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
      )}
    </section>
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
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">{item.concepto}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {item.agente ?? "—"}
        {item.nit ? <span className="ml-2 font-mono">{item.nit}</span> : null}
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.base)}</td>
      <td className="px-3 py-2 text-right font-mono font-medium">
        {FMT.format(item.retenido)}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await deleteRetencionAction(item.id, declId, empresaId);
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
