"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteIvaCapitalAction, updateIvaCapitalAction } from "./actions";

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
  factura: string | null;
  fecha: string | null;
  bien: string;
  proveedor: string | null;
  base: number;
  iva_pagado: number;
  observacion: string | null;
};

export function IvaCapitalList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin bienes registrados.</p>;
  }
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Bien / Proveedor
            </th>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Fecha
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Base
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              IVA
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
  const [bien, setBien] = useState(item.bien);
  const [proveedor, setProveedor] = useState(item.proveedor ?? "");
  const [factura, setFactura] = useState(item.factura ?? "");
  const [fecha, setFecha] = useState(item.fecha ?? "");
  const [base, setBase] = useState(item.base ? FMT.format(item.base) : "");
  const [iva, setIva] = useState(item.iva_pagado ? FMT.format(item.iva_pagado) : "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input value={bien} onChange={(e) => setBien(e.target.value)} className="text-xs" />
          <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Proveedor" className="mt-1 text-xs" />
          <Input value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="Factura" className="mt-1 font-mono text-xs" />
        </td>
        <td className="px-3 py-2"><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-xs" /></td>
        <td className="px-3 py-2"><Input value={base} onChange={(e) => setBase(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={iva} onChange={(e) => setIva(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => {
              await updateIvaCapitalAction(item.id, declId, empresaId, { bien, proveedor: proveedor || null, factura: factura || null, fecha: fecha || null, base: parseNum(base), iva_pagado: parseNum(iva), observacion: item.observacion });
              setEditing(false); router.refresh();
            })} className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50">{pending ? "…" : "Guardar"}</button>
            <button type="button" onClick={() => { setBien(item.bien); setProveedor(item.proveedor ?? ""); setFactura(item.factura ?? ""); setFecha(item.fecha ?? ""); setBase(item.base ? FMT.format(item.base) : ""); setIva(item.iva_pagado ? FMT.format(item.iva_pagado) : ""); setEditing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.bien}</p>
        <p className="text-xs text-muted-foreground">
          {item.proveedor ?? "—"}
          {item.factura ? ` · F. ${item.factura}` : ""}
        </p>
      </td>
      <td className="px-3 py-2 text-sm text-muted-foreground">{item.fecha ?? "—"}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.base)}</td>
      <td className="px-3 py-2 text-right font-mono font-medium">
        {FMT.format(item.iva_pagado)}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-base text-muted-foreground hover:text-foreground" title="Modificar">✏️</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await deleteIvaCapitalAction(item.id, declId, empresaId); router.refresh(); })} className="text-xs text-destructive hover:underline disabled:opacity-50">{pending ? "…" : "Eliminar"}</button>
        </div>
      </td>
    </tr>
  );
}
