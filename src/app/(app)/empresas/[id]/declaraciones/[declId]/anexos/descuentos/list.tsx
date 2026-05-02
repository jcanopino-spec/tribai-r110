"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDescuentoAction } from "./actions";
import { CATEGORIAS, type Categoria } from "./consts";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Item = {
  id: number;
  categoria: string;
  descripcion: string;
  normatividad: string | null;
  base: number;
  valor_descuento: number;
};

export function DescuentoList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  const porCategoria = new Map<string, Item[]>();
  for (const it of items) {
    const arr = porCategoria.get(it.categoria) ?? [];
    arr.push(it);
    porCategoria.set(it.categoria, arr);
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin descuentos registrados todavía.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {CATEGORIAS.map((cat) => {
        const lista = porCategoria.get(cat.id);
        if (!lista || lista.length === 0) return null;
        return (
          <Section
            key={cat.id}
            title={cat.label}
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
                Descripción / Norma
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Base
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Valor descuento
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
      <td className="px-3 py-2">
        <p>{item.descripcion}</p>
        {item.normatividad ? (
          <p className="text-xs text-muted-foreground">{item.normatividad}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.base)}</td>
      <td className="px-3 py-2 text-right font-mono font-medium">
        {FMT.format(item.valor_descuento)}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await deleteDescuentoAction(item.id, declId, empresaId);
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
