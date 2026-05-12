import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadF2516H2 } from "@/lib/f2516-h2-h3";
import { ModuloHeader } from "@/components/modulo-header";
import { H2FilasEditables } from "./form-inline";

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

      <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs">
        ✓ <strong>Auto-poblado oficial DIAN:</strong> el contable se calcula
        automáticamente con el mapeo de 2239 cuentas PUC oficiales (Hoja Sumaria
        del modelo110). Los ajustes (Val2-Val4) son editables abajo · al guardar
        recalcula Val5 (Fiscal).
      </div>

      <H2FilasEditables declId={declId} empresaId={empresaId} filas={filas} />
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
          fontSize: highlight ? "1.4rem" : "1rem",
          fontWeight: "bold",
        }}
      >
        {text ? value : FMT.format(value)}
      </p>
    </div>
  );
}
