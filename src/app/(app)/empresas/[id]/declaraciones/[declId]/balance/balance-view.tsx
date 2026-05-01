"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOverridesAction } from "../importar/actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type Linea = {
  cuenta: string;
  nombre: string | null;
  saldo: number;
  renglon_110: number | null;
};

type Renglon = { numero: number; descripcion: string; seccion: string };

type Total = {
  numero: number;
  total: number;
  descripcion: string;
  seccion: string;
  conteo: number;
};

export function BalanceView({
  empresaId,
  declId,
  balance,
  filter,
  conteos,
  lineas,
  renglones,
  totalesPorRenglon,
}: {
  empresaId: string;
  declId: string;
  balance: { filename: string; uploaded_at: string };
  filter: "todas" | "mapeadas" | "pendientes";
  conteos: { total: number; mapeadas: number; pendientes: number };
  lineas: Linea[];
  renglones: Renglon[];
  totalesPorRenglon: Total[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [edits, setEdits] = useState<Map<string, string>>(new Map());
  const [saved, setSaved] = useState<string | null>(null);

  const grouped = new Map<string, Renglon[]>();
  for (const r of renglones) {
    const arr = grouped.get(r.seccion) ?? [];
    arr.push(r);
    grouped.set(r.seccion, arr);
  }

  function setEdit(cuenta: string, nombre: string | null, valor: string) {
    const next = new Map(edits);
    next.set(cuenta, valor);
    if (nombre) next.set(`__n_${cuenta}`, nombre);
    setEdits(next);
  }

  function valorActual(l: Linea): string {
    const e = edits.get(l.cuenta);
    if (e !== undefined) return e;
    return l.renglon_110 == null ? "" : String(l.renglon_110);
  }

  async function guardar() {
    if (edits.size === 0) return;
    startTransition(async () => {
      const fd = new FormData();
      let count = 0;
      for (const [k, v] of edits.entries()) {
        if (k.startsWith("__n_")) continue;
        fd.set(`r_${k}`, v);
        const nombre = edits.get(`__n_${k}`);
        if (nombre) fd.set(`n_${k}`, nombre);
        count++;
      }
      await saveOverridesAction(empresaId, declId, fd);
      setEdits(new Map());
      setSaved(`Guardado ${count} mapeo${count === 1 ? "" : "s"}. Renglones reagrupados.`);
      router.refresh();
    });
  }

  const totalSaldo = lineas.reduce((s, l) => s + Number(l.saldo), 0);
  const totalAgregado = totalesPorRenglon.reduce((s, t) => s + t.total, 0);
  const editsCount = [...edits.keys()].filter((k) => !k.startsWith("__n_")).length;

  return (
    <div>
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Cargado {new Date(balance.uploaded_at).toLocaleString("es-CO")} · {balance.filename}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Balance cargado
          </h1>
        </div>
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}/importar`}
          className="inline-flex h-10 items-center justify-center rounded-full border border-border-secondary px-5 text-sm hover:bg-muted"
        >
          Reemplazar archivo
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Total líneas" value={conteos.total} />
        <Stat label="Mapeadas" value={conteos.mapeadas} success={conteos.mapeadas > 0} />
        <Stat
          label="Pendientes"
          value={conteos.pendientes}
          alert={conteos.pendientes > 0}
          muted={conteos.pendientes === 0}
        />
      </div>

      <nav className="mt-8 flex border-b border-border">
        {(["todas", "mapeadas", "pendientes"] as const).map((f) => {
          const active = filter === f;
          const conteo = f === "todas" ? conteos.total : f === "mapeadas" ? conteos.mapeadas : conteos.pendientes;
          return (
            <Link
              key={f}
              href={`/empresas/${empresaId}/declaraciones/${declId}/balance?filter=${f}`}
              scroll={false}
              className={`-mb-px border-b-2 px-4 py-3 text-sm capitalize ${
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f} <span className="ml-1 font-mono text-xs">({conteo})</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 overflow-hidden border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                PUC
              </th>
              <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Nombre
              </th>
              <th className="px-4 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Saldo
              </th>
              <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Renglón 110
              </th>
            </tr>
          </thead>
          <tbody>
            {lineas.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No hay líneas que cumplan el filtro.
                </td>
              </tr>
            ) : (
              lineas.map((l) => {
                const isAux = l.cuenta.length >= 6;
                const isEdited = edits.has(l.cuenta);
                return (
                  <tr
                    key={l.cuenta}
                    className={`border-t border-border ${isEdited ? "bg-success/5" : ""} ${
                      !isAux ? "text-muted-foreground" : ""
                    }`}
                  >
                    <td className="px-4 py-1.5 align-top font-mono">{l.cuenta}</td>
                    <td className="px-4 py-1.5 align-top">{l.nombre ?? "—"}</td>
                    <td className="px-4 py-1.5 text-right align-top font-mono">
                      {FMT.format(l.saldo)}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {isAux ? (
                        <select
                          value={valorActual(l)}
                          onChange={(e) => setEdit(l.cuenta, l.nombre, e.target.value)}
                          className="h-9 w-full rounded border border-border bg-card px-2 text-xs"
                        >
                          <option value="">— sin asignar —</option>
                          {[...grouped.entries()].map(([seccion, items]) => (
                            <optgroup key={seccion} label={seccion}>
                              {items.map((r) => (
                                <option key={r.numero} value={r.numero}>
                                  {r.numero} · {r.descripcion}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs italic">cuenta de mayor (no agrega)</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-4 border-t border-border bg-background py-4">
        <p className="text-sm">
          <span className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Suma del listado:
          </span>{" "}
          <span className="font-mono">{FMT.format(totalSaldo)}</span>
        </p>
        <div className="flex items-center gap-3">
          {saved ? <p className="text-sm text-muted-foreground">{saved}</p> : null}
          {editsCount > 0 ? (
            <button
              type="button"
              onClick={guardar}
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Guardando…" : `Guardar ${editsCount} cambio${editsCount === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>
      </div>

      {totalesPorRenglon.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
            Totales por renglón
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Suma de cada renglón a partir de las cuentas auxiliares mapeadas. Es lo que se
            propaga al editor del 110.
          </p>
          <div className="mt-4 overflow-hidden border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                    Renglón
                  </th>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                    Descripción
                  </th>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                    Sección
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                    Cuentas
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {totalesPorRenglon.map((t) => (
                  <tr key={t.numero} className="border-t border-border">
                    <td className="px-4 py-1.5 align-top font-mono">{t.numero}</td>
                    <td className="px-4 py-1.5 align-top">{t.descripcion}</td>
                    <td className="px-4 py-1.5 align-top text-muted-foreground">{t.seccion}</td>
                    <td className="px-4 py-1.5 text-right align-top font-mono">{t.conteo}</td>
                    <td className="px-4 py-1.5 text-right align-top font-mono">
                      {FMT.format(t.total)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/40 font-medium">
                  <td className="px-4 py-2" colSpan={3}>
                    Total
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {totalesPorRenglon.reduce((s, t) => s + t.conteo, 0)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{FMT.format(totalAgregado)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  success,
  alert,
  muted,
}: {
  label: string;
  value: number;
  success?: boolean;
  alert?: boolean;
  muted?: boolean;
}) {
  const cls = alert
    ? "border-destructive/40 bg-destructive/5"
    : success
      ? "border-success/40 bg-success/5"
      : "border-border";
  const valueCls = alert ? "text-destructive" : muted ? "text-muted-foreground" : "";
  return (
    <div className={`border p-4 ${cls}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-2xl tracking-[-0.02em] ${valueCls}`}>
        {FMT.format(value)}
      </p>
    </div>
  );
}
