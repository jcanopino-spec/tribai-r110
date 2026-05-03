"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteDescuentoAction, updateDescuentoAction } from "./actions";
import { CATEGORIAS, type Categoria } from "./consts";

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
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [descripcion, setDescripcion] = useState(item.descripcion);
  const [normatividad, setNormatividad] = useState(item.normatividad ?? "");
  const [base, setBase] = useState(item.base ? FMT.format(item.base) : "");
  const [valor, setValor] = useState(item.valor_descuento ? FMT.format(item.valor_descuento) : "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="text-xs" />
          <Input value={normatividad} onChange={(e) => setNormatividad(e.target.value)} placeholder="Norma" className="mt-1 text-xs" />
        </td>
        <td className="px-3 py-2"><Input value={base} onChange={(e) => setBase(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={valor} onChange={(e) => setValor(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => {
              await updateDescuentoAction(item.id, declId, empresaId, { categoria: item.categoria as Categoria, descripcion, normatividad: normatividad || null, base: parseNum(base), valor_descuento: parseNum(valor) });
              setEditing(false); router.refresh();
            })} className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50">{pending ? "…" : "Guardar"}</button>
            <button type="button" onClick={() => { setDescripcion(item.descripcion); setNormatividad(item.normatividad ?? ""); setBase(item.base ? FMT.format(item.base) : ""); setValor(item.valor_descuento ? FMT.format(item.valor_descuento) : ""); setEditing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

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
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">Modificar</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await deleteDescuentoAction(item.id, declId, empresaId); router.refresh(); })} className="text-xs text-destructive hover:underline disabled:opacity-50">{pending ? "…" : "Eliminar"}</button>
        </div>
      </td>
    </tr>
  );
}
