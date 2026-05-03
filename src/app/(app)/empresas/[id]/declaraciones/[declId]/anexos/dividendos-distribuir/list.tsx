"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteDivDistAction, updateDivDistAction } from "./actions";

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
  socio: string;
  nit: string | null;
  participacion_pct: number;
  dividendo_no_gravado: number;
  dividendo_gravado: number;
  retencion_aplicable: number;
  observacion: string | null;
};

export function DivDistList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin socios registrados.</p>;
  }
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Socio / NIT
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Part.
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              No gravado
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Gravado
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Retención
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
  const [socio, setSocio] = useState(item.socio);
  const [nit, setNit] = useState(item.nit ?? "");
  const [pct, setPct] = useState(String(item.participacion_pct ?? ""));
  const [noGrav, setNoGrav] = useState(item.dividendo_no_gravado ? FMT.format(item.dividendo_no_gravado) : "");
  const [grav, setGrav] = useState(item.dividendo_gravado ? FMT.format(item.dividendo_gravado) : "");
  const [ret, setRet] = useState(item.retencion_aplicable ? FMT.format(item.retencion_aplicable) : "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input value={socio} onChange={(e) => setSocio(e.target.value)} className="text-xs" />
          <Input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="NIT" className="mt-1 font-mono text-xs" />
        </td>
        <td className="px-3 py-2"><Input value={pct} onChange={(e) => setPct(e.target.value)} type="number" inputMode="decimal" min="0" max="100" step="0.01" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={noGrav} onChange={(e) => setNoGrav(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={grav} onChange={(e) => setGrav(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={ret} onChange={(e) => setRet(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => {
              await updateDivDistAction(item.id, declId, empresaId, { socio, nit: nit || null, participacion_pct: Number(pct) || 0, dividendo_no_gravado: parseNum(noGrav), dividendo_gravado: parseNum(grav), retencion_aplicable: parseNum(ret), observacion: item.observacion });
              setEditing(false); router.refresh();
            })} className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50">{pending ? "…" : "Guardar"}</button>
            <button type="button" onClick={() => { setSocio(item.socio); setNit(item.nit ?? ""); setPct(String(item.participacion_pct ?? "")); setNoGrav(item.dividendo_no_gravado ? FMT.format(item.dividendo_no_gravado) : ""); setGrav(item.dividendo_gravado ? FMT.format(item.dividendo_gravado) : ""); setRet(item.retencion_aplicable ? FMT.format(item.retencion_aplicable) : ""); setEditing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.socio}</p>
        <p className="font-mono text-xs text-muted-foreground">{item.nit ?? "—"}</p>
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {Number(item.participacion_pct).toFixed(2)}%
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(item.dividendo_no_gravado)}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(item.dividendo_gravado)}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(item.retencion_aplicable)}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">Modificar</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await deleteDivDistAction(item.id, declId, empresaId); router.refresh(); })} className="text-xs text-destructive hover:underline disabled:opacity-50">{pending ? "…" : "Eliminar"}</button>
        </div>
      </td>
    </tr>
  );
}
