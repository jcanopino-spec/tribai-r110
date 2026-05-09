"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Select } from "@/components/ui/input";
import { deleteInversionEsalAction, updateInversionEsalAction } from "./actions";
import {
  CATEGORIAS_ESAL,
  type InversionEsalItem,
  type TipoInversion,
} from "./consts";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const c = s.replace(/[^0-9]/g, "");
  return c ? FMT.format(Number(c)) : "";
}
function parseN(s: string): number {
  const c = String(s ?? "").replace(/[^0-9]/g, "");
  const n = Number(c);
  return Number.isFinite(n) ? n : 0;
}

export function InversionEsalList({
  items,
  declId,
  empresaId,
}: {
  items: InversionEsalItem[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay inversiones registradas.
      </p>
    );
  }
  const efectuadas = items.filter((i) => i.tipo === "efectuada");
  const liquidadas = items.filter((i) => i.tipo === "liquidada");
  return (
    <div className="space-y-8">
      <Bloque
        titulo="Efectuadas en el año · alimentan R68"
        items={efectuadas}
        declId={declId}
        empresaId={empresaId}
      />
      <Bloque
        titulo="Liquidadas de años anteriores · alimentan R69"
        items={liquidadas}
        declId={declId}
        empresaId={empresaId}
      />
    </div>
  );
}

function Bloque({
  titulo,
  items,
  declId,
  empresaId,
}: {
  titulo: string;
  items: InversionEsalItem[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) return null;
  const total = items.reduce((s, i) => s + Number(i.valor), 0);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          {titulo}
        </h3>
        <p className="font-mono text-xs">
          Total <span className="font-medium">{FMT.format(total)}</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-foreground text-left">
              <Th>Concepto</Th>
              <Th>Categoría</Th>
              <Th>AG</Th>
              <Th>Fecha</Th>
              <Th align="right">Valor</Th>
              <Th />
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
  item: InversionEsalItem;
  declId: string;
  empresaId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [tipo, setTipo] = useState<TipoInversion>(item.tipo);
  const [concepto, setConcepto] = useState(item.concepto);
  const [categoria, setCategoria] = useState(item.categoria ?? "");
  const [fecha, setFecha] = useState(item.fecha ?? "");
  const [anoOrigen, setAnoOrigen] = useState(
    item.ano_origen ? String(item.ano_origen) : "",
  );
  const [valor, setValor] = useState(fmtInput(String(item.valor)));
  const [observacion, setObservacion] = useState(item.observacion ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSave() {
    start(async () => {
      await updateInversionEsalAction(item.id, declId, empresaId, {
        tipo,
        fecha: fecha || null,
        ano_origen: anoOrigen ? Number(anoOrigen) : null,
        concepto,
        categoria: categoria || null,
        valor: parseN(valor),
        observacion: observacion || null,
      });
      setEditing(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm("¿Eliminar esta inversión?")) return;
    start(async () => {
      await deleteInversionEsalAction(item.id, declId, empresaId);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <tr className="border-b border-border text-sm">
        <Td>{item.concepto}</Td>
        <Td>{item.categoria ?? "—"}</Td>
        <Td>{item.ano_origen ?? "—"}</Td>
        <Td>{item.fecha ?? "—"}</Td>
        <Td align="right" mono>
          {FMT.format(item.valor)}
        </Td>
        <Td align="right">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-mono text-xs text-muted-foreground hover:text-foreground"
            title="Modificar"
          >
            ✏️
          </button>{" "}
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="ml-2 font-mono text-xs text-muted-foreground hover:text-destructive"
            title="Eliminar"
          >
            🗑
          </button>
        </Td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b border-border bg-muted/20 text-xs">
        <Td>
          <Input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
          />
        </Td>
        <Td>
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">—</option>
            {CATEGORIAS_ESAL.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Td>
        <Td>
          <Input
            type="number"
            value={anoOrigen}
            onChange={(e) => setAnoOrigen(e.target.value)}
          />
        </Td>
        <Td>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Td>
        <Td>
          <Input
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(fmtInput(e.target.value))}
            className="text-right"
          />
        </Td>
        <Td align="right">
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="font-mono text-xs text-success hover:underline"
          >
            ✓
          </button>{" "}
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="ml-2 font-mono text-xs text-muted-foreground"
          >
            ✕
          </button>
        </Td>
      </tr>
      <tr className="border-b border-border bg-muted/20 text-xs">
        <td className="px-2 py-1 text-muted-foreground" colSpan={6}>
          <div className="flex items-center gap-3">
            <span>Tipo:</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoInversion)}
              className="bg-transparent font-mono"
            >
              <option value="efectuada">Efectuada (R68)</option>
              <option value="liquidada">Liquidada (R69)</option>
            </select>
            <span className="ml-4">Observación:</span>
            <input
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="flex-1 bg-transparent outline-none focus:bg-muted/40 px-1"
              placeholder="opcional"
            />
          </div>
        </td>
      </tr>
    </>
  );
}

function Th({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  align,
  mono,
}: {
  children: React.ReactNode;
  align?: "right";
  mono?: boolean;
}) {
  return (
    <td
      className={`px-2 py-1.5 ${align === "right" ? "text-right" : ""} ${mono ? "font-mono tabular-nums" : ""}`}
    >
      {children}
    </td>
  );
}
