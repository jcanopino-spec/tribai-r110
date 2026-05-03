"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteGoAction, updateGoAction } from "./actions";
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
  concepto: string;
  precio_venta: number;
  costo_fiscal: number;
  no_gravada: number;
  recuperacion_depreciacion: number;
};

export function GoList({
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
        Sin operaciones de ganancia ocasional registradas.
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
  const subPrecio = items.reduce((s, x) => s + Number(x.precio_venta), 0);
  const subCosto = items.reduce((s, x) => s + Number(x.costo_fiscal), 0);
  const subNoGrav = items.reduce((s, x) => s + Number(x.no_gravada), 0);

  return (
    <section>
      <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">{title}</h2>
      <div className="mt-4 overflow-x-auto border border-border">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Concepto
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Precio venta
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Costo fiscal
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                No gravada
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <Row key={it.id} item={it} declId={declId} empresaId={empresaId} />
            ))}
            <tr className="border-t-2 border-border bg-muted/40 font-medium">
              <td className="px-3 py-2 text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Subtotal
              </td>
              <td className="px-3 py-2 text-right font-mono">{FMT.format(subPrecio)}</td>
              <td className="px-3 py-2 text-right font-mono">{FMT.format(subCosto)}</td>
              <td className="px-3 py-2 text-right font-mono">{FMT.format(subNoGrav)}</td>
              <td></td>
            </tr>
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
  const [concepto, setConcepto] = useState(item.concepto);
  const [precio, setPrecio] = useState(item.precio_venta ? FMT.format(item.precio_venta) : "");
  const [costo, setCosto] = useState(item.costo_fiscal ? FMT.format(item.costo_fiscal) : "");
  const [noGrav, setNoGrav] = useState(item.no_gravada ? FMT.format(item.no_gravada) : "");
  const [recDep, setRecDep] = useState(item.recuperacion_depreciacion ? FMT.format(item.recuperacion_depreciacion) : "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} className="text-xs" />
          <Input value={recDep} onChange={(e) => setRecDep(fmtInput(e.target.value))} placeholder="Rec. depreciación" inputMode="numeric" className="mt-1 font-mono text-xs" />
        </td>
        <td className="px-3 py-2"><Input value={precio} onChange={(e) => setPrecio(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={costo} onChange={(e) => setCosto(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={noGrav} onChange={(e) => setNoGrav(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => {
              await updateGoAction(item.id, declId, empresaId, { categoria: item.categoria as Categoria, concepto, precio_venta: parseNum(precio), costo_fiscal: parseNum(costo), no_gravada: parseNum(noGrav), recuperacion_depreciacion: parseNum(recDep) });
              setEditing(false); router.refresh();
            })} className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50">{pending ? "…" : "Guardar"}</button>
            <button type="button" onClick={() => { setConcepto(item.concepto); setPrecio(item.precio_venta ? FMT.format(item.precio_venta) : ""); setCosto(item.costo_fiscal ? FMT.format(item.costo_fiscal) : ""); setNoGrav(item.no_gravada ? FMT.format(item.no_gravada) : ""); setRecDep(item.recuperacion_depreciacion ? FMT.format(item.recuperacion_depreciacion) : ""); setEditing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        {item.concepto}
        {item.recuperacion_depreciacion > 0 ? (
          <span className="ml-2 text-xs text-muted-foreground">
            (rec. depreciación: {FMT.format(item.recuperacion_depreciacion)})
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.precio_venta)}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.costo_fiscal)}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.no_gravada)}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">Modificar</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await deleteGoAction(item.id, declId, empresaId); router.refresh(); })} className="text-xs text-destructive hover:underline disabled:opacity-50">{pending ? "…" : "Eliminar"}</button>
        </div>
      </td>
    </tr>
  );
}
