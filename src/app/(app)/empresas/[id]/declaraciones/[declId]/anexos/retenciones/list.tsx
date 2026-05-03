"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Select } from "@/components/ui/input";
import { deleteRetencionAction, updateRetencionAction } from "./actions";
import { CONCEPTOS_RETENCION, CONCEPTOS_AUTORRETENCION } from "./consts";

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
  tipo: string;
  concepto: string;
  agente: string | null;
  nit: string | null;
  base: number;
  retenido: number;
};

export function RetencionList({
  retenciones,
  autorretenciones,
  declId,
  empresaId,
}: {
  retenciones: Item[];
  autorretenciones: Item[];
  declId: string;
  empresaId: string;
}) {
  return (
    <div className="space-y-10">
      <Section
        title="Retenciones (suman a renglón 106)"
        items={retenciones}
        declId={declId}
        empresaId={empresaId}
      />
      <Section
        title="Autorretenciones (suman a renglón 105)"
        items={autorretenciones}
        declId={declId}
        empresaId={empresaId}
      />
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
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin líneas registradas.</p>
      ) : (
        <div className="mt-4 overflow-x-auto border border-border">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  Concepto
                </th>
                <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  Agente / NIT
                </th>
                <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  Base
                </th>
                <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  Retenido
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
      )}
    </section>
  );
}

function Row({
  item,
  declId,
  empresaId,
}: {
  item: Item;
  declId: string;
  empresaId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  // Estado de edición · pre-cargado con los valores actuales
  const [tipo, setTipo] = useState<"retencion" | "autorretencion">(
    item.tipo as "retencion" | "autorretencion",
  );
  const [concepto, setConcepto] = useState(item.concepto);
  const [agente, setAgente] = useState(item.agente ?? "");
  const [nit, setNit] = useState(item.nit ?? "");
  const [base, setBase] = useState(item.base ? FMT.format(item.base) : "");
  const [retenido, setRetenido] = useState(
    item.retenido ? FMT.format(item.retenido) : "",
  );

  function reset() {
    setTipo(item.tipo as "retencion" | "autorretencion");
    setConcepto(item.concepto);
    setAgente(item.agente ?? "");
    setNit(item.nit ?? "");
    setBase(item.base ? FMT.format(item.base) : "");
    setRetenido(item.retenido ? FMT.format(item.retenido) : "");
  }

  if (editing) {
    const conceptos = tipo === "retencion" ? CONCEPTOS_RETENCION : CONCEPTOS_AUTORRETENCION;
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Select
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="text-xs"
          >
            {conceptos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            value={tipo}
            onChange={(e) =>
              setTipo(e.target.value as "retencion" | "autorretencion")
            }
            className="mt-1 text-xs"
          >
            <option value="retencion">Retención</option>
            <option value="autorretencion">Autorretención</option>
          </Select>
        </td>
        <td className="px-3 py-2">
          <Input
            value={agente}
            onChange={(e) => setAgente(e.target.value)}
            placeholder="Agente"
            className="text-xs"
          />
          <Input
            value={nit}
            onChange={(e) => setNit(e.target.value)}
            placeholder="NIT"
            className="mt-1 font-mono text-xs"
          />
        </td>
        <td className="px-3 py-2 text-right">
          <Input
            value={base}
            onChange={(e) => setBase(fmtInput(e.target.value))}
            inputMode="numeric"
            className="text-right font-mono text-xs"
          />
        </td>
        <td className="px-3 py-2 text-right">
          <Input
            value={retenido}
            onChange={(e) => setRetenido(fmtInput(e.target.value))}
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
                  await updateRetencionAction(item.id, declId, empresaId, {
                    tipo,
                    concepto,
                    agente: agente || null,
                    nit: nit || null,
                    base: parseNum(base),
                    retenido: parseNum(retenido),
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
                reset();
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
      <td className="px-3 py-2">{item.concepto}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {item.agente ?? "—"}
        {item.nit ? <span className="ml-2 font-mono">{item.nit}</span> : null}
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(item.base)}</td>
      <td className="px-3 py-2 text-right font-mono font-medium">
        {FMT.format(item.retenido)}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Modificar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              start(async () => {
                await deleteRetencionAction(item.id, declId, empresaId);
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
