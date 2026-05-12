import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadF2516H3 } from "@/lib/f2516-h2-h3";
import { ModuloHeader } from "@/components/modulo-header";
import { H3FilasEditables } from "./form-inline";

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

      <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs">
        ✓ <strong>Auto-poblado oficial DIAN:</strong> el contable se calcula
        automáticamente con el mapeo de 725 cuentas PUC oficiales (Hoja Sumaria
        del modelo110). Los ajustes (Val2-Val4 + RL por tarifa) son editables
        abajo.
      </div>

      <H3FilasEditables declId={declId} empresaId={empresaId} filas={filas} />
    </div>
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
          fontSize: highlight ? "1.3rem" : "1rem",
          fontWeight: "bold",
        }}
      >
        {text ? value : FMT.format(value)}
      </p>
    </div>
  );
}
