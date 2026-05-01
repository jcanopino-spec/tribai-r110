"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOverridesAction } from "../importar/actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export function HomologarForm({
  empresaId,
  declId,
  cuentas,
  renglones,
  overridesIniciales,
}: {
  empresaId: string;
  declId: string;
  cuentas: { cuenta: string; nombre: string | null; saldo: number }[];
  renglones: { numero: number; descripcion: string; seccion: string }[];
  overridesIniciales: Record<string, number | null>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of cuentas) {
      const v = overridesIniciales[c.cuenta];
      if (v != null) init[c.cuenta] = String(v);
    }
    return init;
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    for (const c of cuentas) {
      const v = seleccion[c.cuenta] ?? "";
      if (v === "") continue;
      fd.set(`r_${c.cuenta}`, v);
      if (c.nombre) fd.set(`n_${c.cuenta}`, c.nombre);
    }
    if ([...fd.keys()].length === 0) {
      setSaved("Selecciona al menos un renglón antes de guardar.");
      return;
    }
    startTransition(async () => {
      await saveOverridesAction(empresaId, declId, fd);
      setSaved("Guardado. El balance se reagregó con tus homologaciones.");
      router.refresh();
    });
  }

  // Group renglones por sección for nicer dropdowns
  const grouped = new Map<string, typeof renglones>();
  for (const r of renglones) {
    const arr = grouped.get(r.seccion) ?? [];
    arr.push(r);
    grouped.set(r.seccion, arr);
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="overflow-hidden border border-border">
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
                Renglón
              </th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map((c) => (
              <tr key={c.cuenta} className="border-t border-border">
                <td className="px-4 py-1.5 align-top font-mono">{c.cuenta}</td>
                <td className="px-4 py-1.5 align-top">{c.nombre ?? "—"}</td>
                <td className="px-4 py-1.5 text-right align-top font-mono">
                  {FMT.format(c.saldo)}
                </td>
                <td className="px-2 py-1 align-top">
                  <select
                    name={`r_${c.cuenta}`}
                    value={seleccion[c.cuenta] ?? ""}
                    onChange={(e) =>
                      setSeleccion((s) => ({ ...s, [c.cuenta]: e.target.value }))
                    }
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar y reagrupar"}
        </button>
        {saved ? <p className="text-sm text-muted-foreground">{saved}</p> : null}
      </div>
    </form>
  );
}
