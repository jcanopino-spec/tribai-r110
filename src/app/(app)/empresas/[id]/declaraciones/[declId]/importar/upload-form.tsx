"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { uploadBalanceAction, type UploadResult } from "./actions";

const initial: UploadResult = {
  error: null,
  filename: null,
  totalLineas: 0,
  mapeadas: 0,
  sinMapear: 0,
  renglonesActualizados: 0,
  sample: [],
  sinMapearCuentas: [],
};

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export function UploadForm({
  declId,
  empresaId,
  yaCargado,
}: {
  declId: string;
  empresaId: string;
  yaCargado: { filename: string; uploaded_at: string } | null;
}) {
  const action = uploadBalanceAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      {yaCargado && !state.filename ? (
        <div className="mb-6 rounded-md border border-border bg-muted/40 p-4 text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Última carga
          </p>
          <p className="mt-1">
            <span className="font-medium">{yaCargado.filename}</span> —{" "}
            {new Date(yaCargado.uploaded_at).toLocaleString("es-CO")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Subir un archivo nuevo reemplaza el balance anterior.
          </p>
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <label
          htmlFor="file"
          className="block cursor-pointer border border-dashed border-border p-10 text-center hover:border-foreground"
        >
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Selecciona o arrastra
          </p>
          <p className="mt-3 font-serif text-xl">Excel (.xlsx, .xls, .xlsm) o CSV</p>
          <input
            ref={inputRef}
            id="file"
            name="file"
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="mt-4 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:text-primary-foreground hover:file:opacity-90"
            required
          />
        </label>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Tamaño máximo 10 MB. Detecta encabezados o usa la primera columna como PUC.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Procesando…" : "Cargar balance"}
          </button>
        </div>

        {state.error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>

      {state.filename && !state.error ? (
        <div className="mt-10 space-y-6">
          <div className="border border-success/40 bg-success/5 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Carga exitosa · {state.filename}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Stat label="Líneas leídas" value={state.totalLineas} />
              <Stat label="Cuentas mapeadas" value={state.mapeadas} />
              <Stat
                label="Sin mapear"
                value={state.sinMapear}
                muted={state.sinMapear === 0}
                alert={state.sinMapear > 0}
              />
              <Stat label="Renglones actualizados" value={state.renglonesActualizados} />
            </div>
          </div>

          {state.sinMapearCuentas.length > 0 ? (
            <div className="border border-destructive/40 bg-destructive/5 p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.05em] text-destructive">
                    Atención · {state.sinMapearCuentas.length} cuenta
                    {state.sinMapearCuentas.length !== 1 ? "s" : ""} sin mapear
                  </p>
                  <h3 className="mt-2 font-serif text-xl leading-[1.1]">
                    Estas cuentas no tienen renglón asignado
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Su saldo NO está incluido en los renglones del 110. Asigna manualmente
                    cada cuenta a su renglón correspondiente.
                  </p>
                </div>
                <Link
                  href={`/empresas/${empresaId}/declaraciones/${declId}/homologar`}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
                >
                  Homologar cuentas →
                </Link>
              </div>
              <table className="mt-4 w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 font-mono text-xs uppercase tracking-[0.05em]">PUC</th>
                    <th className="font-mono text-xs uppercase tracking-[0.05em]">Nombre</th>
                    <th className="text-right font-mono text-xs uppercase tracking-[0.05em]">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.sinMapearCuentas.slice(0, 12).map((l) => (
                    <tr key={l.cuenta} className="border-b border-border last:border-0">
                      <td className="py-1.5 font-mono">{l.cuenta}</td>
                      <td className="pr-2">{l.nombre ?? "—"}</td>
                      <td className="text-right font-mono">{FMT.format(l.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {state.sinMapearCuentas.length > 12 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Y {state.sinMapearCuentas.length - 12} más en la pantalla de homologación.
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <h4 className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Muestra de líneas
            </h4>
            <table className="mt-2 w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 font-mono text-xs uppercase tracking-[0.05em]">Cuenta</th>
                  <th className="font-mono text-xs uppercase tracking-[0.05em]">Nombre</th>
                  <th className="text-right font-mono text-xs uppercase tracking-[0.05em]">
                    Saldo
                  </th>
                  <th className="text-right font-mono text-xs uppercase tracking-[0.05em]">
                    Renglón
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.sample.map((l, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-1.5 font-mono">{l.cuenta}</td>
                    <td className="pr-2">{l.nombre ?? "—"}</td>
                    <td className="text-right font-mono">{FMT.format(l.saldo)}</td>
                    <td className="text-right font-mono">
                      {l.renglon ?? <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/empresas/${empresaId}/declaraciones/${declId}`}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
            >
              Ver declaración →
            </Link>
            {state.sinMapearCuentas.length > 0 ? (
              <Link
                href={`/empresas/${empresaId}/declaraciones/${declId}/homologar`}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border-secondary px-5 text-sm hover:bg-muted"
              >
                Homologar {state.sinMapearCuentas.length} cuentas
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  muted,
  alert,
}: {
  label: string;
  value: number;
  muted?: boolean;
  alert?: boolean;
}) {
  return (
    <div className={`border p-4 ${alert ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-serif text-2xl tracking-[-0.02em] ${
          muted ? "text-muted-foreground" : alert ? "text-destructive" : ""
        }`}
      >
        {FMT.format(value)}
      </p>
    </div>
  );
}
