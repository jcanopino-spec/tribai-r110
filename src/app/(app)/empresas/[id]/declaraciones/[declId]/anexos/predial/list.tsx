"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deletePredialAction, updatePredialAction } from "./actions";

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
  predio: string;
  direccion: string | null;
  matricula: string | null;
  avaluo: number;
  valor_pagado: number;
  observacion: string | null;
};

export function PredialList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin predios registrados.</p>;
  }
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Predio / Dirección
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Avalúo
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
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [predio, setPredio] = useState(item.predio);
  const [direccion, setDireccion] = useState(item.direccion ?? "");
  const [matricula, setMatricula] = useState(item.matricula ?? "");
  const [avaluo, setAvaluo] = useState(item.avaluo ? FMT.format(item.avaluo) : "");
  const [valor, setValor] = useState(item.valor_pagado ? FMT.format(item.valor_pagado) : "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input value={predio} onChange={(e) => setPredio(e.target.value)} className="text-xs" />
          <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección" className="mt-1 text-xs" />
          <Input value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Matrícula" className="mt-1 font-mono text-xs" />
        </td>
        <td className="px-3 py-2"><Input value={avaluo} onChange={(e) => setAvaluo(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={valor} onChange={(e) => setValor(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => {
              await updatePredialAction(item.id, declId, empresaId, { predio, direccion: direccion || null, matricula: matricula || null, avaluo: parseNum(avaluo), valor_pagado: parseNum(valor), observacion: item.observacion });
              setEditing(false); router.refresh();
            })} className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50">{pending ? "…" : "Guardar"}</button>
            <button type="button" onClick={() => { setPredio(item.predio); setDireccion(item.direccion ?? ""); setMatricula(item.matricula ?? ""); setAvaluo(item.avaluo ? FMT.format(item.avaluo) : ""); setValor(item.valor_pagado ? FMT.format(item.valor_pagado) : ""); setEditing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.predio}</p>
        <p className="text-xs text-muted-foreground">
          {item.direccion ?? "—"}
          {item.matricula ? ` · ${item.matricula}` : ""}
        </p>
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.avaluo)}</td>
      <td className="px-3 py-2 text-right font-mono font-medium">
        {FMT.format(item.valor_pagado)}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">Modificar</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await deletePredialAction(item.id, declId, empresaId); router.refresh(); })} className="text-xs text-destructive hover:underline disabled:opacity-50">{pending ? "…" : "Eliminar"}</button>
        </div>
      </td>
    </tr>
  );
}
