import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadF2516H3, type F2516H3Fila } from "@/lib/f2516-h2-h3";
import { ModuloHeader } from "@/components/modulo-header";

export const metadata = { title: "F2516 H3 ERI Renta Líquida" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const DIAN_BLUE = "#1B5AAB";
const DIAN_BLUE_LIGHT = "#E8F1FA";
const TRIBAI_GOLD = "#C4952A";

export default async function H3ERIPage({
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

  const filas = await loadF2516H3(supabase, declId);

  const totalIngresos = filas.find((f) => f.concepto === "INGRESOS")?.fiscal ?? 0;
  const totalCostos = filas.find((f) => /COSTOS/i.test(f.concepto) && f.nivel === 1)?.fiscal ?? 0;
  const conValores = filas.filter((f) => f.fiscal !== 0).length;

  return (
    <div className="max-w-[1400px]">
      <ModuloHeader
        titulo="F2516 · H3 ERI Renta Líquida"
        moduloLabel="Estado de Resultados Integral · Resolución DIAN 71/2019"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
        volverLabel="Formato 2516"
        contexto={`AG ${declaracion.ano_gravable} · ${empresa.razon_social}`}
      />

      <div className="mb-6 rounded-md border" style={{ borderColor: DIAN_BLUE }}>
        <div
          className="px-5 py-3 text-center text-white"
          style={{ backgroundColor: DIAN_BLUE }}
        >
          <h2 className="text-base font-bold uppercase tracking-wide">
            ESTADO DE RESULTADOS INTEGRAL · RENTA LÍQUIDA
          </h2>
          <p className="text-xs opacity-90">
            {filas.length} renglones oficiales · modelo110.xlsm · 12 columnas de valor
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4 px-5 py-3" style={{ backgroundColor: DIAN_BLUE_LIGHT }}>
          <Stat label="Total INGRESOS (fiscal)" value={totalIngresos} />
          <Stat label="Total COSTOS y deducciones" value={totalCostos} />
          <Stat label="Resultado bruto" value={totalIngresos - totalCostos} highlight />
          <Stat label="Renglones con valor" value={conValores} text />
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Hoja con estructura jerárquica oficial DIAN (590 renglones · 6 niveles).
        Cada renglón tiene 5 columnas básicas (Val1-Val5) + 7 columnas de
        <strong> Renta Líquida por tarifa</strong> (Val6-Val12): general, ZF, ECE,
        mega-inversiones, par. 5 Art. 240, dividendos, ganancias ocasionales.
      </p>

      <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
        💡 <strong>Mapeo:</strong> para alimentar el contable, las cuentas deben
        mapearse a su renglón H3 en{" "}
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/h3-eri/mapeo`}
          className="underline hover:text-foreground"
        >
          Mapeo cuenta → renglón H3
        </Link>
        .
      </div>

      <div className="overflow-x-auto rounded-md border" style={{ borderColor: DIAN_BLUE }}>
        <table className="w-full border-collapse text-[11px]">
          <thead style={{ backgroundColor: DIAN_BLUE, color: "white" }}>
            <tr>
              <th className="border border-white/30 px-1 py-2 text-left">NUM</th>
              <th className="border border-white/30 px-1 py-2 text-left" colSpan={1}>
                Concepto
              </th>
              <th className="border border-white/30 px-1 py-2 text-right">Val1 · Contable</th>
              <th className="border border-white/30 px-1 py-2 text-right">Val2 · Conv</th>
              <th className="border border-white/30 px-1 py-2 text-right">Val3 · Menor</th>
              <th className="border border-white/30 px-1 py-2 text-right">Val4 · Mayor</th>
              <th
                className="border border-white/30 px-1 py-2 text-right"
                style={{ backgroundColor: TRIBAI_GOLD, color: DIAN_BLUE }}
              >
                Val5 · FISCAL
              </th>
              <th className="border border-white/30 px-1 py-2 text-right">RL Gen</th>
              <th className="border border-white/30 px-1 py-2 text-right">RL ZF</th>
              <th className="border border-white/30 px-1 py-2 text-right">RL Div</th>
              <th className="border border-white/30 px-1 py-2 text-right">RL GO</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <FilaH3 key={f.id} f={f} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaH3({ f }: { f: F2516H3Fila }) {
  const bgByNivel: Record<number, string> = {
    1: DIAN_BLUE,
    2: DIAN_BLUE_LIGHT,
    3: "transparent",
    4: "transparent",
    5: "transparent",
    6: "transparent",
  };
  const colorByNivel: Record<number, string> = {
    1: "white",
    2: DIAN_BLUE,
    3: "inherit",
    4: "#555",
    5: "#777",
    6: "#999",
  };
  const fontWeight = f.nivel === 1 || f.esTotal ? "bold" : "normal";
  const indent = (f.nivel - 1) * 8;
  return (
    <tr
      style={{
        backgroundColor: bgByNivel[f.nivel] ?? "transparent",
        color: colorByNivel[f.nivel] ?? "inherit",
        fontWeight,
      }}
    >
      <td className="border border-border px-1 py-0.5 font-mono">{f.id}</td>
      <td
        className="border border-border px-1 py-0.5"
        style={{ paddingLeft: indent + 4 }}
      >
        {f.esTotal ? "• " : ""}
        {f.concepto}
      </td>
      <td className="border border-border px-1 py-0.5 text-right font-mono tabular-nums">
        {fmtCell(f.contable)}
      </td>
      <td className="border border-border px-1 py-0.5 text-right font-mono tabular-nums">
        {fmtCell(f.conversion)}
      </td>
      <td className="border border-border px-1 py-0.5 text-right font-mono tabular-nums">
        {fmtCell(f.menor_fiscal)}
      </td>
      <td className="border border-border px-1 py-0.5 text-right font-mono tabular-nums">
        {fmtCell(f.mayor_fiscal)}
      </td>
      <td
        className="border border-border px-1 py-0.5 text-right font-mono tabular-nums"
        style={{ backgroundColor: f.esTotal ? "#FFF8E1" : "transparent", fontWeight: "bold" }}
      >
        {fmtCell(f.fiscal)}
      </td>
      <td className="border border-border px-1 py-0.5 text-right font-mono tabular-nums">
        {fmtCell(f.rl_tarifa_general)}
      </td>
      <td className="border border-border px-1 py-0.5 text-right font-mono tabular-nums">
        {fmtCell(f.rl_zf)}
      </td>
      <td className="border border-border px-1 py-0.5 text-right font-mono tabular-nums">
        {fmtCell(f.rl_dividendos)}
      </td>
      <td className="border border-border px-1 py-0.5 text-right font-mono tabular-nums">
        {fmtCell(f.rl_go)}
      </td>
    </tr>
  );
}

function fmtCell(v: number): string {
  return v === 0 ? "" : FMT.format(v);
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
          fontSize: highlight ? "1.3rem" : "1rem",
          fontWeight: "bold",
        }}
      >
        {text ? value : FMT.format(value)}
      </p>
    </div>
  );
}
