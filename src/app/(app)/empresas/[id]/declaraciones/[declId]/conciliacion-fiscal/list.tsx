"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePartidaAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Item = {
  id: number;
  tipo: string;
  signo: string;
  concepto: string;
  valor: number;
  observacion: string | null;
};

export function PartidasList({
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
  const permanentes = items.filter((i) => i.tipo === "permanente");
  const temporales = items.filter((i) => i.tipo === "temporal");

  return (
    <div className="space-y-10">
      {permanentes.length > 0 ? (
        <Section
          title="Diferencias permanentes"
          subtitle="No se revierten en períodos futuros"
          items={permanentes}
          declId={declId}
          empresaId={empresaId}
        />
      ) : null}
      {temporales.length > 0 ? (
        <Section
          title="Diferencias temporales"
          subtitle="Se revierten en períodos futuros · generan impuesto diferido"
          items={temporales}
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
  items: Item[];
  declId: string;
  empresaId: string;
}) {
  const sumaMas = items.filter((i) => i.signo === "mas").reduce((s, i) => s + Number(i.valor), 0);
  const sumaMenos = items
    .filter((i) => i.signo === "menos")
    .reduce((s, i) => s + Number(i.valor), 0);
  const neto = sumaMas - sumaMenos;

  return (
    <section>
      <header>
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </header>

      <div className="mt-4 overflow-x-auto border border-border">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Concepto
              </th>
              <th className="px-3 py-2 text-center font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Signo
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
          <tfoot className="border-t border-border bg-muted/30">
            <tr>
              <td className="px-3 py-2 font-mono text-xs uppercase text-muted-foreground" colSpan={2}>
                Subtotal
              </td>
              <td
                className={`px-3 py-2 text-right font-mono font-medium ${
                  neto > 0 ? "text-success" : neto < 0 ? "text-destructive" : ""
                }`}
              >
                {neto >= 0 ? "+" : ""}
                {FMT.format(neto)}
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
  item: Item;
  declId: string;
  empresaId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const positivo = item.signo === "mas";
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.concepto}</p>
        {item.observacion ? (
          <p className="text-xs text-muted-foreground">{item.observacion}</p>
        ) : null}
      </td>
      <td className="px-3 py-2 text-center font-mono text-sm">
        {positivo ? (
          <span className="text-success">+ suma</span>
        ) : (
          <span className="text-destructive">− resta</span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono">{FMT.format(Number(item.valor))}</td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await deletePartidaAction(item.id, declId, empresaId);
              router.refresh();
            });
          }}
          className="text-xs text-destructive hover:underline disabled:opacity-50"
        >
          {pending ? "…" : "Eliminar"}
        </button>
      </td>
    </tr>
  );
}
