"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteDifCambioAction, updateDifCambioAction } from "./actions";
import type { Tipo } from "./consts";

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
  cuenta: string | null;
  nit: string | null;
  tercero: string;
  valor_usd: number;
  trm_inicial: number;
  valorInicial: number;
  valorFinal: number;
  diferencia: number;
};

export function DifCambioList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin partidas registradas.</p>;
  }
  const activos = items.filter((i) => i.tipo === "activo");
  const pasivos = items.filter((i) => i.tipo === "pasivo");

  return (
    <div className="space-y-10">
      {activos.length > 0 ? (
        <Section title="Activos" items={activos} declId={declId} empresaId={empresaId} />
      ) : null}
      {pasivos.length > 0 ? (
        <Section title="Pasivos" items={pasivos} declId={declId} empresaId={empresaId} />
      ) : null}
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
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Tercero / Cuenta
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                USD
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                TRM inicial
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                $ inicial
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                $ final
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
    </section>
  );
}

function Row({ item, declId, empresaId }: { item: Item; declId: string; empresaId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [tercero, setTercero] = useState(item.tercero);
  const [cuenta, setCuenta] = useState(item.cuenta ?? "");
  const [nit, setNit] = useState(item.nit ?? "");
  const [usd, setUsd] = useState(item.valor_usd ? FMT.format(item.valor_usd) : "");
  const [trm, setTrm] = useState(String(item.trm_inicial ?? ""));

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input value={tercero} onChange={(e) => setTercero(e.target.value)} className="text-xs" />
          <Input value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder="Cuenta" className="mt-1 font-mono text-xs" />
          <Input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="NIT" className="mt-1 font-mono text-xs" />
        </td>
        <td className="px-3 py-2"><Input value={usd} onChange={(e) => setUsd(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={trm} onChange={(e) => setTrm(e.target.value)} inputMode="decimal" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{FMT.format(item.valorInicial)}</td>
        <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{FMT.format(item.valorFinal)}</td>
        <td className="px-3 py-2 text-right text-xs text-muted-foreground">—</td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => {
              await updateDifCambioAction(item.id, declId, empresaId, { tipo: item.tipo as Tipo, cuenta: cuenta || null, nit: nit || null, tercero, valor_usd: parseNum(usd), trm_inicial: Number(trm) || 0, observacion: null });
              setEditing(false); router.refresh();
            })} className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50">{pending ? "…" : "Guardar"}</button>
            <button type="button" onClick={() => { setTercero(item.tercero); setCuenta(item.cuenta ?? ""); setNit(item.nit ?? ""); setUsd(item.valor_usd ? FMT.format(item.valor_usd) : ""); setTrm(String(item.trm_inicial ?? "")); setEditing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.tercero}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {item.cuenta ?? "—"}
          {item.nit ? ` · ${item.nit}` : ""}
        </p>
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.valor_usd)}</td>
      <td className="px-3 py-2 text-right font-mono">{item.trm_inicial.toFixed(2)}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.valorInicial)}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.valorFinal)}</td>
      <td
        className={`px-3 py-2 text-right font-mono font-medium ${
          item.diferencia > 0
            ? "text-success"
            : item.diferencia < 0
              ? "text-destructive"
              : ""
        }`}
      >
        {FMT.format(item.diferencia)}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-base text-muted-foreground hover:text-foreground" title="Modificar">✏️</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await deleteDifCambioAction(item.id, declId, empresaId); router.refresh(); })} className="text-xs text-destructive hover:underline disabled:opacity-50">{pending ? "…" : "Eliminar"}</button>
        </div>
      </td>
    </tr>
  );
}
