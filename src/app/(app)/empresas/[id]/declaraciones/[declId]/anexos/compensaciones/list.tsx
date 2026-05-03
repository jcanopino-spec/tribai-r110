"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCompensacionAction } from "./actions";
import { TIPOS } from "./consts";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Item = {
  id: number;
  tipo: string;
  ano_origen: number;
  perdida_original: number;
  compensar: number;
  observacion: string | null;
};

export function CompensacionList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  const porTipo = new Map<string, Item[]>();
  for (const it of items) {
    const arr = porTipo.get(it.tipo) ?? [];
    arr.push(it);
    porTipo.set(it.tipo, arr);
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin compensaciones registradas.</p>;
  }

  return (
    <div className="space-y-10">
      {TIPOS.map((tc) => {
        const lista = porTipo.get(tc.id);
        if (!lista || lista.length === 0) return null;
        return (
          <Section
            key={tc.id}
            title={tc.label}
            items={lista}
            declId={declId}
            empresaId={empresaId}
          />
        );
      })}
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
      <div className="mt-4 overflow-x-auto border border-border">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Año origen
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Original
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                A compensar
              </th>
              <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Observación
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
    </section>
  );
}

function Row({ item, declId, empresaId }: { item: Item; declId: string; empresaId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono">{item.ano_origen}</td>
      <td className="px-3 py-2 text-right font-mono">
        {item.perdida_original > 0 ? FMT.format(item.perdida_original) : "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono font-medium">{FMT.format(item.compensar)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{item.observacion ?? "—"}</td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await deleteCompensacionAction(item.id, declId, empresaId);
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
