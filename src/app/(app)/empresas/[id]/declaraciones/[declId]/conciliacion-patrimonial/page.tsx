import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { evaluarPresentacion, ultimoDigitoNit } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";
import { loadConcPatrimonial } from "@/lib/conc-patrimonial";
import { ModuloHeader } from "@/components/modulo-header";
import { PartidaPatrimonialForm } from "./partida-form";
import { PartidasPatrimonialList } from "./list";

export const metadata = { title: "Conciliación Patrimonial" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function ConcPatrimonialPage({
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
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, razon_social, nit, regimen_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  // Compute F110 para tener los renglones derivados (R46, R72, R96, etc)
  let tarifaRegimen: number | null = null;
  if (empresa.regimen_codigo) {
    const { data: reg } = await supabase
      .from("regimenes_tarifas")
      .select("tarifa")
      .eq("codigo", empresa.regimen_codigo)
      .eq("ano_gravable", declaracion.ano_gravable)
      .maybeSingle();
    tarifaRegimen = reg ? Number(reg.tarifa) : null;
  }
  const { data: uvtRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable + 1)
    .eq("codigo", "uvt")
    .maybeSingle();
  const uvtVigente = uvtRow ? Number(uvtRow.valor) : null;
  const tipoContribuyente = declaracion.es_gran_contribuyente
    ? "gran_contribuyente"
    : "persona_juridica";
  const digito = ultimoDigitoNit(empresa.nit);
  let vencimientoSugerido: string | null = null;
  if (digito !== null) {
    const { data: venc } = await supabase
      .from("vencimientos_form110")
      .select("fecha_vencimiento")
      .eq("ano_gravable", declaracion.ano_gravable)
      .eq("tipo_contribuyente", tipoContribuyente)
      .eq("ultimo_digito", digito)
      .maybeSingle();
    vencimientoSugerido = venc?.fecha_vencimiento ?? null;
  }
  const evaluacion = evaluarPresentacion(
    declaracion.fecha_vencimiento ?? vencimientoSugerido,
    declaracion.fecha_presentacion,
  );
  const { data: tarifaRpRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable)
    .eq("codigo", "tarifa_renta_presuntiva")
    .maybeSingle();
  const tarifaRP = tarifaRpRow ? Number(tarifaRpRow.valor) : 0;
  const plAnt =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);
  const depRP =
    Number(declaracion.rp_acciones_sociedades_nacionales ?? 0) +
    Number(declaracion.rp_bienes_actividades_improductivas ?? 0) +
    Number(declaracion.rp_bienes_fuerza_mayor ?? 0) +
    Number(declaracion.rp_bienes_periodo_improductivo ?? 0) +
    Number(declaracion.rp_bienes_mineria ?? 0) +
    Number(declaracion.rp_primeros_19000_uvt_vivienda ?? 0);
  const rentaPresuntiva =
    Math.max(0, plAnt - depRP) * tarifaRP +
    Number(declaracion.rp_renta_gravada_bienes_excluidos ?? 0);

  const [{ data: valores }, anexosCtx, ttdInputs] = await Promise.all([
    supabase.from("form110_valores").select("numero, valor").eq("declaracion_id", declId),
    loadAnexosCtx(supabase, declId, declaracion),
    loadTasaMinimaInputs(supabase, declId, declaracion),
  ]);
  const inputs = new Map<number, number>();
  for (const v of valores ?? []) {
    inputs.set(v.numero, normalizarSigno(v.numero, Number(v.valor)));
  }
  const numerico = computarRenglones(inputs, {
    ...anexosCtx,
    tarifaRegimen: tarifaRegimen ?? undefined,
    impuestoNetoAnterior: Number(declaracion.impuesto_neto_anterior ?? 0),
    aniosDeclarando: declaracion.anios_declarando as
      | "primero" | "segundo" | "tercero_o_mas" | undefined,
    presentacion:
      evaluacion.estado === "extemporanea"
        ? { estado: "extemporanea", mesesExtemporanea: evaluacion.mesesExtemporanea }
        : evaluacion.estado === "oportuna"
          ? { estado: "oportuna" }
          : { estado: "no_presentada" },
    calculaSancionExtemporaneidad: !!declaracion.calcula_sancion_extemporaneidad,
    aplicaTasaMinima:
      aplicaTTDPorRegimen(empresa.regimen_codigo).aplica &&
      (declaracion.aplica_tasa_minima ?? true),
    utilidadContableNeta: ttdInputs.utilidadContableNeta,
    difPermanentesAumentan: ttdInputs.difPermanentesAumentan,
    calculaSancionCorreccion: !!declaracion.calcula_sancion_correccion,
    mayorValorCorreccion: Number(declaracion.mayor_valor_correccion ?? 0),
    existeEmplazamiento: !!declaracion.existe_emplazamiento,
    reduccionSancion: (declaracion.reduccion_sancion ?? "0") as "0" | "50" | "75",
    uvtVigente: uvtVigente ?? undefined,
    patrimonioLiquidoAnterior: plAnt,
    esInstitucionFinanciera: !!declaracion.es_institucion_financiera,
    rentaPresuntiva,
  });

  // Construir Map<numero, valor> desde el cómputo
  const valoresF110 = new Map<number, number>();
  for (const [n, v] of numerico) {
    valoresF110.set(n, Math.abs(v));
  }

  const r = await loadConcPatrimonial(supabase, declId, declaracion, valoresF110);

  // Partidas manuales para el form (datos crudos para los componentes)
  const { data: partidasManualesRaw } = await supabase
    .from("conciliacion_patrimonial_partidas")
    .select("id, signo, concepto, valor, observacion, created_at")
    .eq("declaracion_id", declId)
    .order("created_at");

  return (
    <div className="max-w-5xl">
      <ModuloHeader
        titulo="Conciliación Patrimonial"
        moduloLabel="Art. 236 E.T. · Desvirtuar renta por comparación patrimonial"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones`}
        volverLabel="Conciliaciones"
        contexto={`AG ${declaracion.ano_gravable} · ${empresa.razon_social}`}
      />

      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Modelo del archivo actualicese (Aries). El patrimonio líquido fiscal
        creció entre el dic-31 año anterior y dic-31 año actual: ese crecimiento
        debe estar JUSTIFICADO por las rentas declaradas. Lo que NO se justifica
        se convierte en renta presunta por comparación patrimonial.
      </p>

      {r.estado === "no_aplica" ? (
        <div className="mb-6 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
          ✓ Primer año declarando (Art. 237 E.T.) · la conciliación patrimonial
          no aplica.
        </div>
      ) : null}

      {/* Punto de partida · variación bruta */}
      <Section title="1 · Variación patrimonial">
        <div className="rounded-md border border-border bg-card">
          <Row label="Patrimonio líquido fiscal a dic-31 AÑO ANTERIOR" value={r.plAnterior} />
          <Row label="Patrimonio líquido fiscal a dic-31 AÑO ACTUAL (R46)" value={r.plActual} />
          <Row
            label="Variación patrimonial bruta"
            value={r.variacionBruta}
            emphasis={r.variacionBruta > 0}
          />
        </div>
      </Section>

      {/* Justificantes */}
      <Section title="2 · Justificantes · partidas que explican el crecimiento">
        <p className="mb-3 text-xs text-muted-foreground">
          Las rentas declaradas + ingresos no gravados + deducciones especiales
          + GO neta de impuesto + valorizaciones · sumadas al PL anterior
          deben reconstruir el PL actual.
        </p>
        {r.justificantes.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Sin justificantes capturados.</p>
        ) : (
          <div className="rounded-md border border-border bg-card">
            {r.justificantes.map((j) => (
              <Row key={j.id} label={j.label} value={j.valor} muted origen={j.origen} />
            ))}
            <Row label="Total justificantes" value={r.totalJustificantes} emphasis />
          </div>
        )}
      </Section>

      {/* Restadores */}
      <Section title="3 · Restadores · partidas que NO justifican">
        <p className="mb-3 text-xs text-muted-foreground">
          Gastos contables que SÍ salieron del patrimonio aunque fiscalmente
          no se dedujeron (multas, GMF 50% no deducible, donaciones, etc) ·
          Saldo a pagar año anterior (impuesto efectivamente pagado).
        </p>
        {r.restadores.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Sin restadores capturados.</p>
        ) : (
          <div className="rounded-md border border-border bg-card">
            {r.restadores.map((j) => (
              <Row key={j.id} label={j.label} value={-j.valor} muted origen={j.origen} />
            ))}
            <Row label="Total restadores" value={-r.totalRestadores} emphasis />
          </div>
        )}
      </Section>

      {/* Cómputo final */}
      <Section title="4 · Conciliación final">
        <div className="rounded-md border border-border bg-card">
          <Row label="PL fiscal año anterior" value={r.plAnterior} />
          <Row label="(+) Total justificantes" value={r.totalJustificantes} muted />
          <Row label="(−) Total restadores" value={-r.totalRestadores} muted />
          <Row label="PL JUSTIFICADO" value={r.plJustificado} emphasis />
          <Row label="PL declarado (R46)" value={r.plActual} />
          <Row
            label="DIFERENCIA POR JUSTIFICAR"
            value={r.diferenciaPorJustificar}
            emphasis
            alert={r.diferenciaPorJustificar > 0}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <StatCard
            label="Renta por comparación (Art. 236)"
            value={r.rentaPorComparacion}
            alert={r.rentaPorComparacion > 0}
            ok={r.rentaPorComparacion === 0}
          />
          <StatCard
            label="Estado del cuadre"
            text={
              r.estado === "no_aplica"
                ? "✓ No aplica (primer año)"
                : r.cuadra
                  ? "✓ Cuadrado"
                  : r.rentaPorComparacion > 0
                    ? "⚠ Hay renta presunta a adicionar"
                    : "ℹ Sobrejustificado · revisar"
            }
            alert={r.rentaPorComparacion > 0}
            ok={r.cuadra}
          />
        </div>

        {r.rentaPorComparacion > 0 && (
          <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-300">
              ⚠ Renta presunta por comparación patrimonial: {FMT.format(r.rentaPorComparacion)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Esta diferencia debería sumarse a R78 del F110 (rentas gravables).
              Capturar manualmente en el editor o agregar partidas manuales abajo
              que la justifiquen (valorizaciones, normalizaciones).
            </p>
          </div>
        )}
      </Section>

      {/* Configuración */}
      <Section title="5 · Configuración">
        <div className="rounded-md border border-dashed border-border p-4 text-sm">
          <p className="mb-2 font-medium">Deducción Art. 158-3 y similares</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Inversiones en activos fijos productores de renta. Esta deducción
            rebaja la renta fiscal pero NO disminuyó el patrimonio · por eso
            suma al justificado. Captura en editor de declaración.
          </p>
          <p className="font-mono text-sm">
            Valor actual: {FMT.format(Number(declaracion.deduccion_art_158_3 ?? 0))}
          </p>
        </div>
      </Section>

      {/* Form de partidas manuales */}
      <Section title="6 · Capturar partidas manuales (valorizaciones, normalización)">
        <PartidaPatrimonialForm declId={declId} empresaId={empresaId} />
      </Section>

      {/* Listado */}
      <Section title="7 · Detalle de partidas manuales">
        <PartidasPatrimonialList
          items={(partidasManualesRaw ?? []).map((p) => ({
            id: p.id,
            signo: p.signo as "mas" | "menos",
            concepto: p.concepto,
            valor: Number(p.valor),
            observacion: p.observacion,
            origen: "manual" as const,
          }))}
          declId={declId}
          empresaId={empresaId}
        />
      </Section>
    </div>
  );
}

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

function Row({
  label,
  value,
  muted,
  emphasis,
  alert,
  origen,
}: {
  label: string;
  value: number;
  muted?: boolean;
  emphasis?: boolean;
  alert?: boolean;
  origen?: string;
}) {
  const bgCls = emphasis
    ? alert
      ? "bg-amber-500/10"
      : "bg-amber-500/5"
    : "";
  return (
    <div
      className={`flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0 ${bgCls}`}
    >
      <span
        className={`text-sm ${muted ? "text-muted-foreground" : emphasis ? "font-medium" : ""}`}
      >
        {label}
        {origen ? (
          <span className="ml-2 rounded bg-foreground/10 px-1 font-mono text-[9px] uppercase">
            {origen}
          </span>
        ) : null}
      </span>
      <span
        className={`font-mono tabular-nums ${
          emphasis ? "font-serif text-xl tracking-[-0.02em]" : "text-sm"
        } ${alert ? "text-amber-700 dark:text-amber-400" : ""}`}
      >
        {value < 0 ? "−" : ""}
        {FMT.format(Math.abs(value))}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  text,
  alert,
  ok,
}: {
  label: string;
  value?: number;
  text?: string;
  alert?: boolean;
  ok?: boolean;
}) {
  const cls = alert
    ? "border-amber-500/40 bg-amber-500/5"
    : ok
      ? "border-emerald-500/40 bg-emerald-500/5"
      : "border-border";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-xl tabular-nums">
        {value !== undefined ? FMT.format(value) : text}
      </p>
    </div>
  );
}
