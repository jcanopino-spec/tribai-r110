"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteIvaAction, getPdfUrlAction } from "./actions";
import { IvaForm } from "./iva-form";
import {
  PERIODICIDADES,
  type IvaItem,
  type Periodicidad,
} from "./consts";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export function IvaGrid({
  declId,
  empresaId,
  items,
  periodicidadActiva,
}: {
  declId: string;
  empresaId: string;
  items: IvaItem[];
  periodicidadActiva: Periodicidad;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Periodicidad>(periodicidadActiva);
  const [periodoEditando, setPeriodoEditando] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const cfg = PERIODICIDADES.find((p) => p.id === tab)!;
  const periodos = Array.from({ length: cfg.numPeriodos }, (_, i) => i + 1);
  const itemsPorPeriodo = new Map<number, IvaItem>();
  for (const it of items) {
    if (it.periodicidad === tab) itemsPorPeriodo.set(it.periodo, it);
  }

  function onDelete(id: number) {
    if (!confirm("¿Eliminar esta declaración de IVA?")) return;
    start(async () => {
      await deleteIvaAction(id, declId, empresaId);
      router.refresh();
    });
  }

  async function abrirPdf(path: string) {
    const url = await getPdfUrlAction(path);
    if (url) window.open(url, "_blank");
    else
      alert(
        "No se pudo generar la URL del PDF. Verifica que el bucket 'anexo-iva-pdfs' exista en Supabase Storage.",
      );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-full border border-border p-1">
        {PERIODICIDADES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setTab(p.id);
              setPeriodoEditando(null);
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === p.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label} · {p.numPeriodos} periodos
          </button>
        ))}
      </div>

      {/* Grid de periodos */}
      <div className="grid gap-3 md:grid-cols-3">
        {periodos.map((p) => {
          const it = itemsPorPeriodo.get(p);
          const tieneSaldo = !!(it && (it.saldo_pagar > 0 || it.saldo_favor > 0));
          const sinDatos = !it;
          return (
            <div
              key={p}
              className={`rounded-md border p-4 ${
                sinDatos
                  ? "border-dashed border-border bg-muted/10"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                    Periodo {p} · {cfg.descripcionPeriodo(p)}
                  </p>
                  {it ? (
                    <>
                      <p className="mt-1 font-serif text-lg tabular-nums">
                        {FMT.format(it.ingresos_brutos)}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        Ingresos brutos
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Sin datos
                    </p>
                  )}
                </div>
                {it?.pdf_path ? (
                  <button
                    type="button"
                    onClick={() => abrirPdf(it.pdf_path!)}
                    className="rounded-full border border-border-secondary px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.05em] hover:bg-muted"
                    title={it.pdf_filename ?? "Ver PDF"}
                  >
                    📎 PDF
                  </button>
                ) : null}
              </div>

              {it && tieneSaldo ? (
                <div
                  className={`mt-3 rounded border px-2 py-1 font-mono text-[10px] ${
                    it.saldo_pagar > 0
                      ? "border-destructive/40 bg-destructive/5 text-destructive"
                      : "border-success/40 bg-success/5 text-success"
                  }`}
                >
                  {it.saldo_pagar > 0
                    ? `Pagar: ${FMT.format(it.saldo_pagar)}`
                    : `Favor: ${FMT.format(it.saldo_favor)}`}
                </div>
              ) : null}

              <div className="mt-3 flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setPeriodoEditando(periodoEditando === p ? null : p)
                  }
                  className="font-mono text-muted-foreground hover:text-foreground"
                >
                  {it ? "✏️ editar" : "+ capturar"}
                </button>
                {it ? (
                  <button
                    type="button"
                    onClick={() => onDelete(it.id)}
                    disabled={pending}
                    className="font-mono text-muted-foreground hover:text-destructive"
                    title="Eliminar"
                  >
                    🗑
                  </button>
                ) : null}
              </div>

              {periodoEditando === p ? (
                <div className="mt-4 border-t border-border pt-4">
                  <IvaForm
                    declId={declId}
                    empresaId={empresaId}
                    periodicidad={tab}
                    periodo={p}
                    inicial={it ?? null}
                    onCancelar={() => setPeriodoEditando(null)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
