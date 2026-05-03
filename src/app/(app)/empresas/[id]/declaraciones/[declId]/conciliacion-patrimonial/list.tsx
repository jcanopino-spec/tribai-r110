"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePartidaPatrimonialAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export type PartidaItem = {
  id: number | string;
  signo: "mas" | "menos";
  concepto: string;
  valor: number;
  observacion: string | null;
  origen: "manual" | "auto";
  fuente?: string;
};

export function PartidasPatrimonialList({
  items,
  declId,
  empresaId,
}: {
  items: PartidaItem[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin partidas. Las auto-derivadas aparecerán cuando guardes ingresos,
        costos o anexos. Las manuales se agregan abajo.
      </p>
    );
  }

  const aumentos = items.filter((i) => i.signo === "mas");
  const disminuciones = items.filter((i) => i.signo === "menos");

  return (
    <div className="space-y-8">
      {aumentos.length > 0 ? (
        <Section
          title="Aumentos del patrimonio"
          subtitle="Conceptos que incrementan el patrimonio líquido fiscal"
          items={aumentos}
          declId={declId}
          empresaId={empresaId}
        />
      ) : null}
      {disminuciones.length > 0 ? (
        <Section
          title="Disminuciones del patrimonio"
          subtitle="Conceptos que reducen el patrimonio líquido fiscal"
          items={disminuciones}
          declId={declId}
          empresaId={empresaId}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  subtitle,
  items,
  declId,
  empresaId,
}: {
  title: string;
  subtitle: string;
  items: PartidaItem[];
  declId: string;
  empresaId: string;
}) {
  const total = items.reduce((s, i) => s + Number(i.valor), 0);
  return (
    <section>
      <header>
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          {title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </header>
      <div className="mt-4 overflow-x-auto border border-border">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Concepto
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Valor
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <Row key={`${it.origen}-${it.id}`} item={it} declId={declId} empresaId={empresaId} />
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30">
            <tr>
              <td className="px-3 py-2 font-mono text-xs uppercase text-muted-foreground">
                Subtotal
              </td>
              <td className="px-3 py-2 text-right font-mono font-medium">
                {FMT.format(total)}
              </td>
              <td></td>
            </tr>
          </tfoot>
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
  item: PartidaItem;
  declId: string;
  empresaId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isAuto = item.origen === "auto";
  return (
    <tr className={`border-t border-border ${isAuto ? "bg-muted/20" : ""}`}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <p className="font-medium">{item.concepto}</p>
          {isAuto ? (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground"
              title={item.fuente ? `Origen: ${item.fuente}` : "Derivado automáticamente"}
            >
              auto · {item.fuente ?? ""}
            </span>
          ) : null}
        </div>
        {item.observacion ? (
          <p className="text-xs text-muted-foreground">{item.observacion}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(Number(item.valor))}
      </td>
      <td className="px-3 py-2 text-right">
        {isAuto ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              start(async () => {
                await deletePartidaPatrimonialAction(Number(item.id), declId, empresaId);
                router.refresh();
              });
            }}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            {pending ? "…" : "Eliminar"}
          </button>
        )}
      </td>
    </tr>
  );
}
