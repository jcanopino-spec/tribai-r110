"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteInteresAction, updateInteresAction } from "./actions";

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
  cuenta: string | null;
  saldo_promedio: number;
  dias: number;
  interes_registrado: number;
  interesPresunto: number;
  diferencia: number;
  observacion: string | null;
};

export function InteresList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin préstamos registrados.</p>;
  }

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Socio / Cuenta
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Saldo
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Días
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Interés presunto
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Interés registrado
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Diferencia
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
  const [cuenta, setCuenta] = useState(item.cuenta ?? "");
  const [saldo, setSaldo] = useState(item.saldo_promedio ? FMT.format(item.saldo_promedio) : "");
  const [dias, setDias] = useState(String(item.dias));
  const [registrado, setRegistrado] = useState(item.interes_registrado ? FMT.format(item.interes_registrado) : "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input value={socio} onChange={(e) => setSocio(e.target.value)} className="text-xs" />
          <Input value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder="Cuenta PUC" className="mt-1 font-mono text-xs" />
        </td>
        <td className="px-3 py-2"><Input value={saldo} onChange={(e) => setSaldo(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={dias} onChange={(e) => setDias(e.target.value)} type="number" min="1" max="365" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{FMT.format(item.interesPresunto)}</td>
        <td className="px-3 py-2"><Input value={registrado} onChange={(e) => setRegistrado(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2 text-right text-xs text-muted-foreground">—</td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => {
              await updateInteresAction(item.id, declId, empresaId, { socio, cuenta: cuenta || null, saldo_promedio: parseNum(saldo), dias: Number(dias) || 360, interes_registrado: parseNum(registrado), observacion: item.observacion });
              setEditing(false); router.refresh();
            })} className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50">{pending ? "…" : "Guardar"}</button>
            <button type="button" onClick={() => { setSocio(item.socio); setCuenta(item.cuenta ?? ""); setSaldo(item.saldo_promedio ? FMT.format(item.saldo_promedio) : ""); setDias(String(item.dias)); setRegistrado(item.interes_registrado ? FMT.format(item.interes_registrado) : ""); setEditing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.socio}</p>
        {item.cuenta ? (
          <p className="font-mono text-xs text-muted-foreground">{item.cuenta}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.saldo_promedio)}</td>
      <td className="px-3 py-2 text-right font-mono">{item.dias}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.interesPresunto)}</td>
      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
        {FMT.format(item.interes_registrado)}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono font-medium ${
          item.diferencia > 0 ? "text-destructive" : ""
        }`}
      >
        {FMT.format(item.diferencia)}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">Modificar</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await deleteInteresAction(item.id, declId, empresaId); router.refresh(); })} className="text-xs text-destructive hover:underline disabled:opacity-50">{pending ? "…" : "Eliminar"}</button>
        </div>
      </td>
    </tr>
  );
}
