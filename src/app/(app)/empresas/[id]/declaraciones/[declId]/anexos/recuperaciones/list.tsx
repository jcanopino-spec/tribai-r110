"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteRecuperacionAction, updateRecuperacionAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/[^0-9]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

type Item = {
  id: number;
  concepto: string;
  descripcion: string;
  valor: number;
  observacion: string | null;
};

export function RecuperacionList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin recuperaciones registradas.</p>;
  }

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Concepto / descripción
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Valor
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
  const [concepto, setConcepto] = useState(item.concepto);
  const [descripcion, setDescripcion] = useState(item.descripcion);
  const [valor, setValor] = useState(item.valor ? FMT.format(item.valor) : "");
  const [observacion, setObservacion] = useState(item.observacion ?? "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Concepto"
            className="text-xs"
          />
          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción"
            className="mt-1 text-xs"
          />
          <Input
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Observación (opcional)"
            className="mt-1 text-xs"
          />
        </td>
        <td className="px-3 py-2">
          <Input
            value={valor}
            onChange={(e) => setValor(fmtInput(e.target.value))}
            inputMode="numeric"
            className="text-right font-mono text-xs"
          />
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  await updateRecuperacionAction(item.id, declId, empresaId, {
                    concepto,
                    descripcion,
                    valor: parseNum(valor),
                    observacion: observacion || null,
                  });
                  setEditing(false);
                  router.refresh();
                });
              }}
              className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConcepto(item.concepto);
                setDescripcion(item.descripcion);
                setValor(item.valor ? FMT.format(item.valor) : "");
                setObservacion(item.observacion ?? "");
                setEditing(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.concepto}</p>
        <p className="text-xs text-muted-foreground">{item.descripcion}</p>
        {item.observacion ? (
          <p className="text-xs italic text-muted-foreground">— {item.observacion}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.valor)}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-base text-muted-foreground hover:text-foreground" title="Modificar">✏️</button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              start(async () => {
                await deleteRecuperacionAction(item.id, declId, empresaId);
                router.refresh();
              });
            }}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            {pending ? "…" : "Eliminar"}
          </button>
        </div>
      </td>
    </tr>
  );
}
