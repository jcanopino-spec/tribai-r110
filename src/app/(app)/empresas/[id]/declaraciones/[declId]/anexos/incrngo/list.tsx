"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteIncrngoAction, updateIncrngoAction } from "./actions";

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
  normatividad: string | null;
  valor: number;
};

export function IncrngoList({
  items,
  declId,
  empresaId,
}: {
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin INCRNGO registrados.</p>;
  }

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Concepto / Norma
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
  const [normatividad, setNormatividad] = useState(item.normatividad ?? "");
  const [valor, setValor] = useState(item.valor ? FMT.format(item.valor) : "");

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="text-xs"
          />
          <Input
            value={normatividad}
            onChange={(e) => setNormatividad(e.target.value)}
            placeholder="Norma (Art. ___ E.T.)"
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
                  await updateIncrngoAction(item.id, declId, empresaId, {
                    concepto,
                    normatividad: normatividad || null,
                    valor: parseNum(valor),
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
                setNormatividad(item.normatividad ?? "");
                setValor(item.valor ? FMT.format(item.valor) : "");
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
        <p>{item.concepto}</p>
        {item.normatividad ? (
          <p className="text-xs text-muted-foreground">{item.normatividad}</p>
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
                await deleteIncrngoAction(item.id, declId, empresaId);
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
