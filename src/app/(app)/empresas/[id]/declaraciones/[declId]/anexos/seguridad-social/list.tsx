"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteSegSocialAction, updateSegSocialAction } from "./actions";

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
  empleado: string;
  cedula: string | null;
  salario: number;
  aporte_salud: number;
  aporte_pension: number;
  aporte_arl: number;
  aporte_parafiscales: number;
  observacion: string | null;
};

export function SegSocialList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin empleados registrados.</p>;
  }
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Empleado
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Salario
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Salud
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Pensión
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              ARL
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Parafiscales
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
  const [empleado, setEmpleado] = useState(item.empleado);
  const [cedula, setCedula] = useState(item.cedula ?? "");
  const [salario, setSalario] = useState(item.salario ? FMT.format(item.salario) : "");
  const [salud, setSalud] = useState(item.aporte_salud ? FMT.format(item.aporte_salud) : "");
  const [pension, setPension] = useState(item.aporte_pension ? FMT.format(item.aporte_pension) : "");
  const [arl, setArl] = useState(item.aporte_arl ? FMT.format(item.aporte_arl) : "");
  const [paraf, setParaf] = useState(item.aporte_parafiscales ? FMT.format(item.aporte_parafiscales) : "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input value={empleado} onChange={(e) => setEmpleado(e.target.value)} className="text-xs" />
          <Input value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="Cédula" className="mt-1 font-mono text-xs" />
        </td>
        <td className="px-3 py-2"><Input value={salario} onChange={(e) => setSalario(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={salud} onChange={(e) => setSalud(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={pension} onChange={(e) => setPension(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={arl} onChange={(e) => setArl(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2"><Input value={paraf} onChange={(e) => setParaf(fmtInput(e.target.value))} inputMode="numeric" className="text-right font-mono text-xs" /></td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => {
              await updateSegSocialAction(item.id, declId, empresaId, { empleado, cedula: cedula || null, salario: parseNum(salario), aporte_salud: parseNum(salud), aporte_pension: parseNum(pension), aporte_arl: parseNum(arl), aporte_parafiscales: parseNum(paraf), observacion: item.observacion });
              setEditing(false); router.refresh();
            })} className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50">{pending ? "…" : "Guardar"}</button>
            <button type="button" onClick={() => { setEmpleado(item.empleado); setCedula(item.cedula ?? ""); setSalario(item.salario ? FMT.format(item.salario) : ""); setSalud(item.aporte_salud ? FMT.format(item.aporte_salud) : ""); setPension(item.aporte_pension ? FMT.format(item.aporte_pension) : ""); setArl(item.aporte_arl ? FMT.format(item.aporte_arl) : ""); setParaf(item.aporte_parafiscales ? FMT.format(item.aporte_parafiscales) : ""); setEditing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.empleado}</p>
        <p className="font-mono text-xs text-muted-foreground">{item.cedula ?? "—"}</p>
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.salario)}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.aporte_salud)}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.aporte_pension)}</td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.aporte_arl)}</td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(item.aporte_parafiscales)}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground">Modificar</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await deleteSegSocialAction(item.id, declId, empresaId); router.refresh(); })} className="text-xs text-destructive hover:underline disabled:opacity-50">{pending ? "…" : "Eliminar"}</button>
        </div>
      </td>
    </tr>
  );
}
