import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadF2516H2, type F2516H2Fila } from "@/lib/f2516-h2-h3";
import { ModuloHeader } from "@/components/modulo-header";

export const metadata = { title: "F2516 H2 ESF Patrimonio" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const DIAN_BLUE = "#1B5AAB";
const DIAN_BLUE_LIGHT = "#E8F1FA";
const TRIBAI_GOLD = "#C4952A";

export default async function H2ESFPage({
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
    .select("razon_social, nit")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  const filas = await loadF2516H2(supabase, declId);

  // Stats
  const totalActivos = filas.find((f) => f.concepto === "ACTIVOS")?.fiscal ?? 0;
  const totalPasivos = filas.find((f) => f.concepto.toUpperCase() === "PASIVOS")?.fiscal ?? 0;
  const conValores = filas.filter((f) => f.fiscal !== 0).length;

  return (
    <div className="max-w-7xl">
      <ModuloHeader
        titulo="F2516 · H2 ESF Patrimonio"
        moduloLabel="Estado de Situación Financiera · Resolución DIAN 71/2019"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
        volverLabel="Formato 2516"
        contexto={`AG ${declaracion.ano_gravable} · ${empresa.razon_social}`}
      />

      {/* Banner DIAN oficial */}
      <div className="mb-6 rounded-md border" style={{ borderColor: DIAN_BLUE }}>
        <div
          className="px-5 py-3 text-center text-white"
          style={{ backgroundColor: DIAN_BLUE }}
        >
          <h2 className="text-base font-bold uppercase tracking-wide">
            ESTADO DE SITUACIÓN FINANCIERA · PATRIMONIO
          </h2>
          <p className="text-xs opacity-90">
            {filas.length} renglones oficiales · modelo110.xlsm
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4 px-5 py-3" style={{ backgroundColor: DIAN_BLUE_LIGHT }}>
          <Stat label="Total ACTIVOS (fiscal)" value={totalActivos} />
          <Stat label="Total PASIVOS (fiscal)" value={totalPasivos} />
          <Stat label="Patrimonio líquido" value={totalActivos - totalPasivos} highlight />
          <Stat label="Renglones con valor" value={conValores} text />
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Hoja con la estructura jerárquica oficial DIAN (250 renglones · 5 niveles).
        El <strong>valor contable</strong> se computa desde el balance vía el mapeo
        cuenta → renglón. Los <strong>ajustes</strong> (conversión, menor/mayor fiscal)
        se capturan manualmente. El <strong>valor fiscal</strong> = Contable + Conversión − Menor + Mayor.
      </p>

      <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
        💡 <strong>Mapeo de cuentas:</strong> para que las cuentas del balance lleguen
        a su renglón H2 correcto, ve a{" "}
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/h2-esf/mapeo`}
          className="underline hover:text-foreground"
        >
          Mapeo cuenta → renglón H2
        </Link>
        . Las cuentas sin mapear no aparecen en esta hoja.
      </div>

      {/* Tabla H2 estilo DIAN */}
      <div className="overflow-x-auto rounded-md border" style={{ borderColor: DIAN_BLUE }}>
        <table className="w-full border-collapse text-xs">
          <thead style={{ backgroundColor: DIAN_BLUE, color: "white" }}>
            <tr>
              <th className="border border-white/30 px-2 py-2 text-left font-bold uppercase">
                NUM
              </th>
              <th className="border border-white/30 px-2 py-2 text-left font-bold uppercase">
                Concepto
              </th>
              <th className="border border-white/30 px-2 py-2 text-right font-bold uppercase">
                Val 1 · Contable
              </th>
              <th className="border border-white/30 px-2 py-2 text-right font-bold uppercase">
                Val 2 · Conversión
              </th>
              <th className="border border-white/30 px-2 py-2 text-right font-bold uppercase">
                Val 3 · Menor Fiscal
              </th>
              <th className="border border-white/30 px-2 py-2 text-right font-bold uppercase">
                Val 4 · Mayor Fiscal
              </th>
              <th className="border border-white/30 px-2 py-2 text-right font-bold uppercase">
                Val 5 · Fiscal
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <FilaH2 key={f.id} f={f} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Para capturar ajustes manuales por renglón, click en cada fila.
        El mapeo de cuentas se gestiona en{" "}
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}/balance`}
          className="underline hover:text-foreground"
        >
          Balance
        </Link>
        .
      </p>
    </div>
  );
}

function FilaH2({ f }: { f: F2516H2Fila }) {
  const bgByNivel: Record<number, string> = {
    1: DIAN_BLUE, // categoría principal · banner azul
    2: DIAN_BLUE_LIGHT,
    3: "transparent",
    4: "transparent",
    5: "transparent",
  };
  const colorByNivel: Record<number, string> = {
    1: "white",
    2: DIAN_BLUE,
    3: "inherit",
    4: "#666",
    5: "#888",
  };
  const fontWeight = f.nivel === 1 || f.esTotal ? "bold" : "normal";
  const indent = (f.nivel - 1) * 12;

  return (
    <tr
      style={{
        backgroundColor: bgByNivel[f.nivel] ?? "transparent",
        color: colorByNivel[f.nivel] ?? "inherit",
        fontWeight,
      }}
    >
      <td className="border border-border px-2 py-1 font-mono">{f.id}</td>
      <td className="border border-border px-2 py-1" style={{ paddingLeft: indent + 8 }}>
        {f.esTotal ? "• " : ""}
        {f.concepto}
      </td>
      <td className="border border-border px-2 py-1 text-right font-mono tabular-nums">
        {f.contable === 0 ? "" : FMT.format(f.contable)}
      </td>
      <td className="border border-border px-2 py-1 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
        {f.conversion === 0 ? "" : FMT.format(f.conversion)}
      </td>
      <td className="border border-border px-2 py-1 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
        {f.menor_fiscal === 0 ? "" : FMT.format(f.menor_fiscal)}
      </td>
      <td className="border border-border px-2 py-1 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
        {f.mayor_fiscal === 0 ? "" : FMT.format(f.mayor_fiscal)}
      </td>
      <td
        className="border border-border px-2 py-1 text-right font-mono tabular-nums"
        style={{ backgroundColor: f.esTotal ? "#FFF8E1" : "transparent", fontWeight: f.esTotal ? "bold" : "normal" }}
      >
        {f.fiscal === 0 ? "" : FMT.format(f.fiscal)}
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  highlight,
  text,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  text?: boolean;
}) {
  return (
    <div className="rounded border bg-white p-2" style={{ borderColor: DIAN_BLUE }}>
      <p className="font-mono text-[9px] uppercase tracking-[0.05em]" style={{ color: DIAN_BLUE }}>
        {label}
      </p>
      <p
        className="mt-1 font-mono tabular-nums"
        style={{
          color: highlight ? TRIBAI_GOLD : DIAN_BLUE,
          fontSize: highlight ? "1.4rem" : "1rem",
          fontWeight: "bold",
        }}
      >
        {text ? value : FMT.format(value)}
      </p>
    </div>
  );
}
