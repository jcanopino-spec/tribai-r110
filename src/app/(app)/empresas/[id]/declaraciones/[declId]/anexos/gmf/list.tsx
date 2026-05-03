"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteGmfAction, updateGmfAction } from "./actions";

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
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [entidad, setEntidad] = useState(item.entidad);
  const [periodo, setPeriodo] = useState(item.periodo ?? "");
  const [valor, setValor] = useState(item.valor_gmf ? FMT.format(item.valor_gmf) : "");
  const [observacion, setObservacion] = useState(item.observacion ?? "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input value={entidad} onChange={(e) => setEntidad(e.target.value)} className="text-xs" />
          <Input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Observación" className="mt-1 text-xs" />
        </td>
        <td className="px-3 py-2">
          <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ene–Dic 2025" className="text-xs" />
        </td>
        <td className="px-3 py-2">
          <Input value={valor} onChange={(e) => setValor(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" />
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => {
              await updateGmfAction(item.id, declId, empresaId, { entidad, periodo: periodo || null, valor_gmf: parseNum(valor), observacion: observacion || null });
              setEditing(false); router.refresh();
            })} className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50">{pending ? "…" : "Guardar"}</button>
            <button type="button" onClick={() => { setEntidad(item.entidad); setPeriodo(item.periodo ?? ""); setValor(item.valor_gmf ? FMT.format(item.valor_gmf) : ""); setObservacion(item.observacion ?? ""); setEditing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

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
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">Modificar</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await deleteGmfAction(item.id, declId, empresaId); router.refresh(); })} className="text-xs text-destructive hover:underline disabled:opacity-50">{pending ? "…" : "Eliminar"}</button>
        </div>
      </td>
    </tr>
  );
}
