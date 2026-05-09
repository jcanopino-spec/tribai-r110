// Página de diagnóstico para verificar QUÉ CUENTAS del balance están
// alimentando cada fila del F2516. Útil cuando hay descuadres
// inesperados (ej. "el total pasivo está inflado") para identificar
// la cuenta raíz del problema sin tener que abrir el balance crudo.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { categorizarPucF2516, F2516_FILAS, type F2516FilaId } from "@/engine/f2516";
import { categorizarPucPasivosID } from "@/engine/impuesto-diferido";
import { ModuloHeader } from "@/components/modulo-header";

export const metadata = { title: "Diagnóstico F2516" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const FILA_LABEL: Record<F2516FilaId, string> = {} as Record<F2516FilaId, string>;
for (const f of F2516_FILAS) FILA_LABEL[f.id] = f.label;

type LineaInfo = {
  cuenta: string;
  cuentaNum: string;
  nombre: string | null;
  saldo: number;
  ajusteDb: number;
  ajusteCr: number;
  fiscal: number;
  filaF2516: F2516FilaId | null;
  catPasivoID: string | null;
  esResumen: boolean;
  incluidaF2516: boolean;
};

export default async function DiagnosticoPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, empresa_id")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("razon_social")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  const { data: balance } = await supabase
    .from("balance_pruebas")
    .select("id, filename, uploaded_at")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!balance) {
    return (
      <div className="max-w-5xl">
        <ModuloHeader
          titulo="Diagnóstico F2516"
          moduloLabel="Inspección · cuentas del balance"
          volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
          volverLabel="F2516"
        />
        <p className="text-sm text-muted-foreground">
          No hay balance cargado para esta declaración.
        </p>
      </div>
    );
  }

  const { data: lineas } = await supabase
    .from("balance_prueba_lineas")
    .select("cuenta, nombre, saldo, ajuste_debito, ajuste_credito")
    .eq("balance_id", balance.id);

  // Detectar cuentas resumen (con hijas presentes)
  const todasCuentas = new Set<string>();
  for (const l of lineas ?? []) {
    const c = String(l.cuenta).replace(/[^0-9]/g, "");
    if (c) todasCuentas.add(c);
  }
  const tieneHijas = (cuenta: string): boolean => {
    for (const otra of todasCuentas) {
      if (otra.length > cuenta.length && otra.startsWith(cuenta)) return true;
    }
    return false;
  };

  const items: LineaInfo[] = (lineas ?? []).map((l) => {
    const cuentaNum = String(l.cuenta).replace(/[^0-9]/g, "");
    const filaF2516 = categorizarPucF2516(cuentaNum);
    const catPasivoID = categorizarPucPasivosID(cuentaNum);
    const esResumen = tieneHijas(cuentaNum);
    const fiscal =
      Number(l.saldo) + Number(l.ajuste_debito) - Number(l.ajuste_credito);
    return {
      cuenta: String(l.cuenta),
      cuentaNum,
      nombre: l.nombre,
      saldo: Number(l.saldo),
      ajusteDb: Number(l.ajuste_debito),
      ajusteCr: Number(l.ajuste_credito),
      fiscal,
      filaF2516,
      catPasivoID,
      esResumen,
      incluidaF2516: !!filaF2516 && !esResumen,
    };
  });

  // Agregados por fila F2516 (incluye solo hojas)
  const totalesPorFila = new Map<F2516FilaId, number>();
  const cuentasPorFila = new Map<F2516FilaId, LineaInfo[]>();
  for (const it of items) {
    if (!it.incluidaF2516 || !it.filaF2516) continue;
    const filaId = it.filaF2516;
    totalesPorFila.set(filaId, (totalesPorFila.get(filaId) ?? 0) + it.fiscal);
    const arr = cuentasPorFila.get(filaId) ?? [];
    arr.push(it);
    cuentasPorFila.set(filaId, arr);
  }
  // Aplicar abs solo al final (igual que f2516-aggregates)
  for (const id of [
    "ESF_10_PASIVOS",
    "ERI_12_INGRESOS",
    "ERI_13_DEVOL",
  ] as const) {
    if (totalesPorFila.has(id)) {
      totalesPorFila.set(id, Math.abs(totalesPorFila.get(id) ?? 0));
    }
  }

  // Stats globales
  const sinClasificar = items.filter((i) => !i.filaF2516 && i.cuentaNum);
  const resumenes = items.filter((i) => i.esResumen);
  const incluidas = items.filter((i) => i.incluidaF2516);

  const totalActivos =
    (totalesPorFila.get("ESF_01_EFECTIVO") ?? 0) +
    (totalesPorFila.get("ESF_02_INVERSIONES") ?? 0) +
    (totalesPorFila.get("ESF_03_CXC") ?? 0) +
    (totalesPorFila.get("ESF_04_INVENT") ?? 0) +
    (totalesPorFila.get("ESF_05_INTAN") ?? 0) +
    (totalesPorFila.get("ESF_06_BIO") ?? 0) +
    (totalesPorFila.get("ESF_07_PPE") ?? 0) +
    (totalesPorFila.get("ESF_08_OTROS") ?? 0);

  const totalPasivos = totalesPorFila.get("ESF_10_PASIVOS") ?? 0;

  return (
    <div className="max-w-6xl">
      <ModuloHeader
        titulo="Diagnóstico F2516"
        moduloLabel="Inspección · cuentas del balance"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
        volverLabel="F2516"
        contexto={`${empresa.razon_social} · AG ${declaracion.ano_gravable} · balance ${balance.filename ?? balance.id}`}
      />

      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Lista cada cuenta del balance con su clasificación al F2516, si fue
        incluida o no, y por qué (cuenta resumen vs hoja). Usa esta vista
        cuando los totales del F2516 no cuadren contra tu balance externo.
      </p>

      <div className="mb-8 grid gap-3 md:grid-cols-4">
        <Stat label="Líneas en balance" value={items.length} />
        <Stat label="Cuentas resumen excluidas" value={resumenes.length} alert />
        <Stat label="Hojas incluidas en F2516" value={incluidas.length} ok />
        <Stat label="Sin clasificar" value={sinClasificar.length} warn={sinClasificar.length > 0} />
      </div>

      <section className="mb-8 grid gap-3 md:grid-cols-2">
        <div className="border border-border p-4">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Total Activos (suma de filas 1-8)
          </p>
          <p className="mt-1 font-serif text-2xl tabular-nums">
            {FMT.format(totalActivos)}
          </p>
        </div>
        <div className="border border-border p-4">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Total Pasivos
          </p>
          <p className="mt-1 font-serif text-2xl tabular-nums">
            {FMT.format(totalPasivos)}
          </p>
        </div>
      </section>

      {/* Detalle por fila F2516 */}
      <h2 className="mb-3 mt-10 font-mono text-xs uppercase tracking-[0.08em] text-foreground">
        Cuentas que componen cada fila
      </h2>
      {Array.from(cuentasPorFila.entries()).map(([filaId, cuentas]) => {
        const total = cuentas.reduce((s, c) => s + c.fiscal, 0);
        const totalAbs =
          filaId === "ESF_10_PASIVOS" ||
          filaId === "ERI_12_INGRESOS" ||
          filaId === "ERI_13_DEVOL"
            ? Math.abs(total)
            : total;
        return (
          <section
            key={filaId}
            className="mb-6 border border-border"
          >
            <header className="flex items-center justify-between bg-muted/30 px-3 py-2 border-b border-border">
              <p className="text-sm font-medium">
                {FILA_LABEL[filaId]} · {cuentas.length} cuenta(s)
              </p>
              <p className="font-mono text-sm tabular-nums">
                Total {FMT.format(totalAbs)}
              </p>
            </header>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-[10px]">
                  <Th>Cuenta</Th>
                  <Th>Nombre</Th>
                  <Th align="right">Saldo</Th>
                  <Th align="right">Aj.DB</Th>
                  <Th align="right">Aj.CR</Th>
                  <Th align="right">Fiscal</Th>
                </tr>
              </thead>
              <tbody>
                {cuentas
                  .sort((a, b) => Math.abs(b.fiscal) - Math.abs(a.fiscal))
                  .map((c, i) => (
                    <tr key={`${filaId}-${i}`} className="border-b border-border/50 text-xs">
                      <Td><span className="font-mono">{c.cuenta}</span></Td>
                      <Td>{c.nombre ?? "—"}</Td>
                      <NumTd v={c.saldo} />
                      <NumTd v={c.ajusteDb} />
                      <NumTd v={c.ajusteCr} />
                      <NumTd v={c.fiscal} bold />
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {/* Cuentas resumen (excluidas) */}
      {resumenes.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-amber-700 dark:text-amber-500">
            Cuentas resumen excluidas · {resumenes.length}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Estas cuentas tienen subcuentas presentes en el balance, así que
            su saldo es la suma de sus hijas y se EXCLUYE del cálculo para
            evitar duplicación.
          </p>
          <table className="w-full border border-border">
            <thead>
              <tr className="border-b-2 border-foreground bg-muted/30 text-left">
                <Th>Cuenta</Th>
                <Th>Nombre</Th>
                <Th align="right">Saldo</Th>
                <Th>Categoría F2516</Th>
              </tr>
            </thead>
            <tbody>
              {resumenes
                .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))
                .slice(0, 30)
                .map((c, i) => (
                  <tr key={i} className="border-b border-border/50 text-xs">
                    <Td><span className="font-mono">{c.cuenta}</span></Td>
                    <Td>{c.nombre ?? "—"}</Td>
                    <NumTd v={c.saldo} />
                    <Td>
                      {c.filaF2516 ? FILA_LABEL[c.filaF2516] : "—"}
                    </Td>
                  </tr>
                ))}
            </tbody>
          </table>
          {resumenes.length > 30 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              … y {resumenes.length - 30} cuentas resumen adicionales.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Cuentas sin clasificar */}
      {sinClasificar.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-destructive">
            Sin clasificar · {sinClasificar.length}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Estas cuentas no se mapean a ninguna categoría del F2516
            (típicamente clases 8, 9 o cuentas de orden). Si deberían
            estar en el F2516, revisa que el código PUC tenga el formato
            correcto.
          </p>
          <table className="w-full border border-border">
            <thead>
              <tr className="border-b-2 border-foreground bg-muted/30 text-left">
                <Th>Cuenta</Th>
                <Th>Nombre</Th>
                <Th align="right">Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {sinClasificar
                .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))
                .slice(0, 30)
                .map((c, i) => (
                  <tr key={i} className="border-b border-border/50 text-xs">
                    <Td><span className="font-mono">{c.cuenta}</span></Td>
                    <Td>{c.nombre ?? "—"}</Td>
                    <NumTd v={c.saldo} />
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  ok,
  warn,
  alert,
}: {
  label: string;
  value: number;
  ok?: boolean;
  warn?: boolean;
  alert?: boolean;
}) {
  const cls = ok
    ? "border-success/40 bg-success/5"
    : warn
      ? "border-amber-500/40 bg-amber-500/5"
      : alert
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-border";
  return (
    <div className={`border p-4 ${cls}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5">{children}</td>;
}
function NumTd({ v, bold }: { v: number; bold?: boolean }) {
  return (
    <td
      className={`px-2 py-1.5 text-right font-mono text-xs tabular-nums ${bold ? "font-semibold" : ""} ${v < 0 ? "text-destructive" : ""}`}
    >
      {v === 0 ? "" : FMT.format(v)}
    </td>
  );
}
