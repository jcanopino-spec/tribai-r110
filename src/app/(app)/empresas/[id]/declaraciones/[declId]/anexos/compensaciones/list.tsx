"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteCompensacionAction, updateCompensacionAction } from "./actions";
import { TIPOS, type Tipo } from "./consts";

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
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [ano, setAno] = useState(String(item.ano_origen));
  const [original, setOriginal] = useState(item.perdida_original ? FMT.format(item.perdida_original) : "");
  const [compensar, setCompensar] = useState(item.compensar ? FMT.format(item.compensar) : "");
  const [observacion, setObservacion] = useState(item.observacion ?? "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2"><Input value={ano} onChange={(e) => setAno(e.target.value)} type="number" className="font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={original} onChange={(e) => setOriginal(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={compensar} onChange={(e) => setCompensar(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Observación" className="text-xs" /></td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => {
              await updateCompensacionAction(item.id, declId, empresaId, { tipo: item.tipo as Tipo, ano_origen: Number(ano) || item.ano_origen, perdida_original: parseNum(original), compensar: parseNum(compensar), observacion: observacion || null });
              setEditing(false); router.refresh();
            })} className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50">{pending ? "…" : "Guardar"}</button>
            <button type="button" onClick={() => { setAno(String(item.ano_origen)); setOriginal(item.perdida_original ? FMT.format(item.perdida_original) : ""); setCompensar(item.compensar ? FMT.format(item.compensar) : ""); setObservacion(item.observacion ?? ""); setEditing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono">{item.ano_origen}</td>
      <td className="px-3 py-2 text-right font-mono">
        {item.perdida_original > 0 ? FMT.format(item.perdida_original) : "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono font-medium">{FMT.format(item.compensar)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{item.observacion ?? "—"}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">Modificar</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await deleteCompensacionAction(item.id, declId, empresaId); router.refresh(); })} className="text-xs text-destructive hover:underline disabled:opacity-50">{pending ? "…" : "Eliminar"}</button>
        </div>
      </td>
    </tr>
  );
}
