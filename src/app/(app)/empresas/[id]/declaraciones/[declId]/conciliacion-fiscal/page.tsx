import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computarConcUtilidades,
  computarLimiteBeneficios,
  SUBCATEGORIA_LABEL,
  type PartidaConc,
  type SubcategoriaConc,
} from "@/engine/conc-utilidades";
import { loadConcUtilidades } from "@/lib/conc-utilidades";
import { ModuloHeader } from "@/components/modulo-header";
import { PartidaForm } from "./partida-form";
import { PartidasList } from "./list";

export const metadata = { title: "Conciliación de Utilidad" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function ConcUtilidadPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("*")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  // Cargar valores del F110 (lado fiscal del PyG y los 3 cuadres)
  const { data: valoresRows } = await supabase
    .from("form110_valores")
    .select("numero, valor")
    .eq("declaracion_id", declId);
  const valoresF110 = new Map<number, number>();
  for (const v of valoresRows ?? []) {
    valoresF110.set(v.numero, Math.abs(Number(v.valor)));
  }

  // Llamada al loader · agrupa balance + anexos + partidas + flags
  const input = await loadConcUtilidades(supabase, declaracion, valoresF110);
  const r = computarConcUtilidades(input);

  const partidasAuto = r.partidas.filter((p) => p.origen === "auto");
  const partidasManuales = r.partidas.filter((p) => p.origen === "manual");

  // Estimación informativa de impuesto diferido (tarifa 35%)
  const tarifaID = 0.35;
  const impuestoDiferidoNeto =
    (r.subtotales.temporariasDeducibles - r.subtotales.temporariasImponibles) *
    tarifaID;

  // Control límite 35% beneficios (Art. 240 par. 5)
  // Por defecto sin beneficios especiales · si la empresa los usa, capturarlos manualmente.
  // En implementación futura este loader leería de los anexos especiales (Art. 158-1, etc).
  const limite = computarLimiteBeneficios({
    rentaLiquidaGravable: valoresF110.get(79) ?? 0,
    deduccionesEspeciales: 0,
    ingresosNoGravadosEspeciales: 0,
    descuentosEspeciales: 0,
    tarifa: 0.35,
  });

  return (
    <div className="max-w-6xl">
      <ModuloHeader
        titulo="Conciliación de Utilidad"
        moduloLabel="Módulo 10b · Utilidad contable → Renta fiscal"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones`}
        volverLabel="Conciliaciones"
        contexto={`AG ${declaracion.ano_gravable}`}
      />

      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Reconcilia la utilidad contable (NIIF) con la renta líquida fiscal.
        El bloque PyG compara las dos visiones por concepto. Las partidas
        de conciliación se clasifican en 3 categorías según NIC 12:
        permanentes (no revierten) · temporarias deducibles (suman a la fiscal,
        generan ATD) · temporarias imponibles (restan, generan PTD).
      </p>

      {/* PyG · 3 columnas (Contable | Fiscal | Diferencia) */}
      <Section title="1 · Estado de Resultados · Contable vs Fiscal">
        <p className="mb-3 text-xs text-muted-foreground">
          Lado contable · SUMIF al balance de prueba por prefijo PUC. Lado
          fiscal · renglones del Formulario 110 ya computados.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-foreground text-left">
                <Th>Concepto</Th>
                <Th align="right">Contable</Th>
                <Th align="right">Fiscal</Th>
                <Th align="right">Diferencia</Th>
              </tr>
            </thead>
            <tbody>
              {r.filasPyG.map((f) => (
                <tr
                  key={f.id}
                  className={`border-b border-border/50 ${
                    f.esTotal ? "bg-muted/30 font-semibold" : ""
                  }`}
                >
                  <td className="px-2 py-2">{f.concepto}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {FMT.format(f.contable)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {FMT.format(f.fiscal)}
                  </td>
                  <td
                    className={`px-2 py-2 text-right font-mono tabular-nums ${
                      Math.abs(f.diferencia) > 1
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {f.diferencia < 0 ? "−" : ""}
                    {FMT.format(Math.abs(f.diferencia))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Partidas de conciliación · 3 categorías NIC 12 con subcategorías */}
      <Section title="2 · Partidas de Conciliación · NIC 12 / IFRS">
        <p className="mb-3 text-xs text-muted-foreground">
          Cada partida se clasifica por su naturaleza tributaria (estructura
          actualicese / archivo Aries) dentro de las 3 categorías NIC 12.
          Las marcadas <span className="font-mono uppercase">auto</span> se
          derivan de los anexos y balance fiscal.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <CategoryCard
            title="Temporarias deducibles"
            descripcion="Suman a la utilidad fiscal · generan ATD"
            partidas={r.partidas.filter((p) => p.categoria === "temporaria_deducible")}
            subtotal={r.subtotales.temporariasDeducibles}
            color="emerald"
          />
          <CategoryCard
            title="Temporarias imponibles"
            descripcion="Restan de la utilidad fiscal · generan PTD"
            partidas={r.partidas.filter((p) => p.categoria === "temporaria_imponible")}
            subtotal={r.subtotales.temporariasImponibles}
            color="rose"
          />
          <CategoryCard
            title="Permanentes"
            descripcion="No revierten · afectan solo la renta fiscal del año"
            partidas={r.partidas.filter((p) => p.categoria === "permanente")}
            subtotal={r.subtotales.permanentes}
            color="amber"
          />
        </div>

        {/* Detalle por subcategoría · estructura archivo Aries */}
        <div className="mt-6">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Detalle por subcategoría tributaria
          </h3>
          <SubcategoriaTabla partidas={r.partidas} />
        </div>
      </Section>

      {/* Cómputo final · fórmula + cuadres */}
      <Section title="3 · Renta Líquida Fiscal Calculada">
        <p className="mb-3 text-xs text-muted-foreground">
          Fórmula NIC 12: Renta Fiscal = Utilidad Contable + ΔTempDed −
          ΔTempImp + Permanentes
        </p>
        <div className="rounded-md border border-border bg-card">
          <Row label="Utilidad contable antes de impuestos" value={r.utilidadContableTotal} />
          <Row
            label="(+) Diferencias temporarias deducibles"
            value={r.subtotales.temporariasDeducibles}
            muted
          />
          <Row
            label="(−) Diferencias temporarias imponibles"
            value={-r.subtotales.temporariasImponibles}
            muted
          />
          <Row label="(±) Diferencias permanentes" value={r.subtotales.permanentes} muted />
          <Row
            label="RENTA LÍQUIDA FISCAL CALCULADA"
            value={r.rentaLiquidaCalculada}
            emphasis
          />
        </div>

        {/* Triple cuadre vs F110 */}
        <h3 className="mt-6 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Cruce con el Formulario 110
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <CuadreCard
            label="vs R72 · Renta líquida ordinaria"
            calculada={r.cuadres.vsR72.calculada}
            real={r.cuadres.vsR72.real}
            ok={r.cuadres.vsR72.ok}
          />
          <CuadreCard
            label="vs R75 · Post compensaciones"
            calculada={r.cuadres.vsR75.calculada}
            real={r.cuadres.vsR75.real}
            ok={r.cuadres.vsR75.ok}
          />
          <CuadreCard
            label="vs R79 · Renta líquida gravable"
            calculada={r.cuadres.vsR79.calculada}
            real={r.cuadres.vsR79.real}
            ok={r.cuadres.vsR79.ok}
          />
        </div>
        <p
          className={`mt-3 text-xs ${
            r.estado === "cuadrado"
              ? "text-success"
              : r.estado === "descuadrado_leve"
                ? "text-amber-700"
                : "text-destructive"
          }`}
        >
          {r.estado === "cuadrado"
            ? "✓ La conciliación cuadra con R72 (tolerancia 1 peso)."
            : r.estado === "descuadrado_leve"
              ? "⚠ Diferencia leve · puede ser por redondeos."
              : "⨯ Diferencia material · revisa las partidas o el balance fiscal."}
        </p>
      </Section>

      {/* Control límite 35% beneficios · Art. 240 par. 5 */}
      <Section title="4 · Control Límite 35% Beneficios · Art. 240 par. 5">
        <p className="mb-3 text-xs text-muted-foreground">
          La suma de deducciones especiales, ingresos no gravados especiales y
          descuentos tributarios especiales no puede beneficiar al contribuyente
          más de lo que se ahorraría con la sola tarifa del 35% sobre la renta
          líquida ajustada. Si excede, se causa un impuesto a adicionar.
        </p>
        <div className="rounded-md border border-border bg-card">
          <Row label="Parámetro 1 · (RL gravable + ded. esp.) × 35%" value={limite.parametro1} />
          <Row label="Parámetro 2 · (ded. esp. + INCRNGO esp.) × 35% + descuentos esp." value={limite.parametro2} />
          <Row
            label="Impuesto a adicionar (R239) · max(0, P2 − P1)"
            value={limite.impuestoAdicionar}
            emphasis
          />
        </div>
        <p
          className={`mt-3 text-xs ${
            limite.excedeLimite ? "text-destructive" : "text-success"
          }`}
        >
          {limite.excedeLimite
            ? `⚠ Los beneficios exceden el límite · adicional ${FMT.format(limite.impuestoAdicionar)}.`
            : "✓ Los beneficios no exceden el límite del 35%."}
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Aries (régimen general sin beneficios especiales) tiene parámetro 2 = 0.
          Para empresas con Art. 158-1, 256, 257 esp., la captura se hace en
          los anexos correspondientes; este control se ejecuta automáticamente.
        </p>
      </Section>

      {/* Impuesto diferido informativo */}
      <Section title="5 · Impacto en Impuesto Diferido (NIC 12)">
        <p className="text-xs text-muted-foreground">
          Estimación informativa con tarifa nominal {(tarifaID * 100).toFixed(0)}%.
          El cálculo detallado por categoría está en{" "}
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516/h4-impuesto-diferido`}
            className="underline hover:text-foreground"
          >
            F2516 H4
          </Link>
          .
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat
            label="Σ Temporarias deducibles"
            value={r.subtotales.temporariasDeducibles}
          />
          <Stat
            label="Σ Temporarias imponibles"
            value={r.subtotales.temporariasImponibles}
          />
          <Stat
            label={
              impuestoDiferidoNeto >= 0
                ? "ATD estimado (35%)"
                : "PTD estimado (35%)"
            }
            value={Math.abs(impuestoDiferidoNeto)}
            emphasis
          />
        </div>
      </Section>

      {/* Captura manual */}
      <Section title="6 · Capturar partida manual">
        <PartidaForm declId={declId} empresaId={empresaId} />
      </Section>

      {/* Listado completo · auto + manual */}
      <Section title="7 · Detalle de todas las partidas">
        <p className="mb-3 text-xs text-muted-foreground">
          {partidasAuto.length} partidas automáticas · {partidasManuales.length}{" "}
          manuales. Las auto se actualizan al cambiar el anexo origen.
        </p>
        <PartidasList
          items={r.partidas.map((p) => ({
            id: p.origen === "manual" ? Number(p.id.replace(/^manual-/, "")) : p.id,
            tipo: p.categoria === "permanente" ? "permanente" : "temporal",
            signo: p.signo,
            concepto: p.concepto,
            valor: p.valor,
            observacion: p.observacion ?? null,
            origen: p.origen,
          }))}
          declId={declId}
          empresaId={empresaId}
        />
      </Section>
    </div>
  );
}

// ============================================================
// COMPONENTES UI
// ============================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

type ColorKey = "emerald" | "rose" | "amber";
const COLORS: Record<ColorKey, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/5",
  rose: "border-rose-500/30 bg-rose-500/5",
  amber: "border-amber-500/30 bg-amber-500/5",
};

function CategoryCard({
  title,
  descripcion,
  partidas,
  subtotal,
  color,
}: {
  title: string;
  descripcion: string;
  partidas: { id: string; concepto: string; valor: number; signo: string; origen: string }[];
  subtotal: number;
  color: ColorKey;
}) {
  return (
    <div className={`rounded-md border p-4 ${COLORS[color]}`}>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {descripcion}
      </p>
      <div className="mt-3 max-h-48 overflow-y-auto">
        {partidas.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">Sin partidas.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {partidas.map((p) => (
              <li key={p.id} className="flex items-baseline gap-2">
                <span
                  className={`inline-block w-3 text-center font-mono ${
                    p.signo === "mas" ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {p.signo === "mas" ? "+" : "−"}
                </span>
                <span className="flex-1 truncate" title={p.concepto}>
                  {p.concepto}
                </span>
                <span className="font-mono tabular-nums">
                  {FMT.format(p.valor)}
                </span>
                {p.origen === "auto" && (
                  <span className="ml-1 rounded bg-foreground/10 px-1 font-mono text-[9px] uppercase">
                    auto
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 border-t border-foreground/10 pt-2">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
            Subtotal
          </span>
          <span className="font-mono text-base font-semibold tabular-nums">
            {subtotal < 0 ? "−" : ""}
            {FMT.format(Math.abs(subtotal))}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: number;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0 ${
        emphasis ? "bg-amber-500/5" : ""
      }`}
    >
      <span
        className={`text-sm ${
          muted ? "text-muted-foreground" : emphasis ? "font-medium" : ""
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${
          emphasis ? "font-serif text-xl tracking-[-0.02em]" : "text-sm"
        }`}
      >
        {value < 0 ? "−" : ""}
        {FMT.format(Math.abs(value))}
      </span>
    </div>
  );
}

function CuadreCard({
  label,
  calculada,
  real,
  ok,
}: {
  label: string;
  calculada: number;
  real: number;
  ok: boolean;
}) {
  const dif = calculada - real;
  const cls = ok
    ? "border-emerald-500/40 bg-emerald-500/5"
    : "border-destructive/40 bg-destructive/5";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-xs">
        Calc: <span className="tabular-nums">{FMT.format(calculada)}</span>
      </p>
      <p className="font-mono text-xs">
        F110: <span className="tabular-nums">{FMT.format(real)}</span>
      </p>
      <p className={`mt-1 font-mono text-sm font-semibold ${ok ? "" : "text-destructive"}`}>
        {ok ? "✓ Cuadrado" : `Δ ${dif < 0 ? "−" : ""}${FMT.format(Math.abs(dif))}`}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className={`rounded-md border p-3 ${emphasis ? "border-foreground/40 bg-amber-500/5" : "border-border"}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-xl tabular-nums">{FMT.format(value)}</p>
    </div>
  );
}

/**
 * Tabla de partidas agrupada por subcategoría tributaria (estructura del
 * archivo Aries / actualicese). Las 6 subcategorías + "otros" se renderizan
 * como secciones colapsables con subtotales.
 */
function SubcategoriaTabla({ partidas }: { partidas: PartidaConc[] }) {
  const orden: NonNullable<SubcategoriaConc>[] = [
    "ingresos_no_gravados",
    "ingresos_contables_no_fiscales",
    "gastos_fiscales_no_contables",
    "gastos_no_deducibles",
    "ingresos_fiscales_no_contables",
    "partidas_no_afectan_renta",
  ];

  const grupos = new Map<string, PartidaConc[]>();
  for (const p of partidas) {
    const key = p.subcategoria ?? "_otros";
    const arr = grupos.get(key) ?? [];
    arr.push(p);
    grupos.set(key, arr);
  }

  // Subcategorías con al menos 1 partida + "otros" si hay
  const subcatsConDatos = orden.filter((s) => (grupos.get(s) ?? []).length > 0);
  const otros = grupos.get("_otros") ?? [];

  if (subcatsConDatos.length === 0 && otros.length === 0) {
    return <p className="text-xs italic text-muted-foreground">Sin partidas para clasificar.</p>;
  }

  return (
    <div className="space-y-3">
      {subcatsConDatos.map((sub) => {
        const items = grupos.get(sub) ?? [];
        const subtotal = items.reduce(
          (s, p) => s + (p.signo === "mas" ? p.valor : -p.valor),
          0,
        );
        return (
          <div key={sub} className="rounded-md border border-border">
            <div className="flex items-baseline justify-between bg-muted/30 px-3 py-2">
              <h4 className="font-mono text-[11px] uppercase tracking-[0.05em]">
                {SUBCATEGORIA_LABEL[sub]}
              </h4>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {subtotal < 0 ? "−" : ""}
                {FMT.format(Math.abs(subtotal))}
              </span>
            </div>
            <ul className="divide-y divide-border/50 text-xs">
              {items.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <span
                    className={`inline-block w-3 text-center font-mono ${
                      p.signo === "mas" ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {p.signo === "mas" ? "+" : "−"}
                  </span>
                  <span className="flex-1 truncate" title={p.observacion ?? p.concepto}>
                    {p.concepto}
                  </span>
                  <span className="font-mono tabular-nums">{FMT.format(p.valor)}</span>
                  {p.origen === "auto" && (
                    <span className="rounded bg-foreground/10 px-1 font-mono text-[9px] uppercase">
                      auto
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {otros.length > 0 && (
        <div className="rounded-md border border-dashed border-border">
          <div className="flex items-baseline justify-between bg-muted/20 px-3 py-2">
            <h4 className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
              Sin subcategoría (manuales · clasificar)
            </h4>
            <span className="text-xs text-muted-foreground">{otros.length} partida(s)</span>
          </div>
          <ul className="divide-y divide-border/50 text-xs">
            {otros.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                <span className={`inline-block w-3 text-center font-mono ${p.signo === "mas" ? "text-emerald-700" : "text-rose-700"}`}>
                  {p.signo === "mas" ? "+" : "−"}
                </span>
                <span className="flex-1 truncate">{p.concepto}</span>
                <span className="font-mono tabular-nums">{FMT.format(p.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
