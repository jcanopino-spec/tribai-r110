import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { evaluarPresentacion, ultimoDigitoNit } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";
import { loadF2516Aggregates } from "@/lib/f2516-aggregates";
import {
  evaluarChecklist,
  resumenChecklist,
  type ChecklistEstado,
} from "@/engine/checklist";
import { validarF2516, TOLERANCIA_CUADRE } from "@/engine/validaciones";

export const metadata = { title: "Checklist Normativo" };

const SECCIONES_ORDEN = [
  "DATOS",
  "PATRIMONIO",
  "INGRESOS",
  "COSTOS",
  "LIQUIDACION",
  "CONCILIACION",
  "FORMAL",
] as const;

const SECCION_DESC: Record<(typeof SECCIONES_ORDEN)[number], string> = {
  DATOS: "Identificación y matrícula",
  PATRIMONIO: "Activos, pasivos, patrimonio",
  INGRESOS: "Operacionales, no operacionales y dividendos",
  COSTOS: "Causalidad, soporte, deducibilidad",
  LIQUIDACION: "Tarifa, TTD, descuentos, anticipo",
  CONCILIACION: "Patrimonial, utilidad, F2516",
  FORMAL: "Plazo y firmas",
};

export default async function ChecklistPage({
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
    .select("id, razon_social, nit, dv, ciiu_codigo, regimen_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

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

  const { data: uvtRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable + 1)
    .eq("codigo", "uvt")
    .maybeSingle();
  const uvtVigente = uvtRow ? Number(uvtRow.valor) : null;

  const plAnt =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);

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
    aplicaTasaMinima:
      aplicaTTDPorRegimen(empresa.regimen_codigo).aplica &&
      (declaracion.aplica_tasa_minima ?? true),
    utilidadContableNeta: ttdInputs.utilidadContableNeta,
    difPermanentesAumentan: ttdInputs.difPermanentesAumentan,
    uvtVigente: uvtVigente ?? undefined,
    patrimonioLiquidoAnterior: plAnt,
    esInstitucionFinanciera: !!declaracion.es_institucion_financiera,
  });

  // F2516 cuadre · revisamos si hay descuadres usando la validación oficial
  const f2516Filas = await loadF2516Aggregates(supabase, declId, numerico);
  const valF2516 = validarF2516(f2516Filas);
  const hayDescuadresF2516 = valF2516.some(
    (v) => v.nivel === "error" || v.nivel === "warn",
  );
  void TOLERANCIA_CUADRE;

  const ttdAplicaPorRegimen = aplicaTTDPorRegimen(empresa.regimen_codigo).aplica;

  const resultados = evaluarChecklist({
    nit: empresa.nit,
    dv: empresa.dv,
    ciiu: empresa.ciiu_codigo,
    razonSocial: empresa.razon_social,
    regimenCodigo: empresa.regimen_codigo,
    tarifaRegimen,
    numerico,
    presentacionOportuna: evaluacion.estado === "oportuna",
    ttdAplicaPorRegimen,
    esVinculadoSubcap: !!declaracion.sub_es_vinculado,
    codRepresentacion: declaracion.cod_representacion ?? null,
    codContadorRF: declaracion.cod_contador_rf ?? null,
    hayDescuadresF2516,
    calculaAnticipo: !!declaracion.calcula_anticipo,
    aniosDeclarando: declaracion.anios_declarando as
      | "primero" | "segundo" | "tercero_o_mas" | undefined,
  });

  const resumen = resumenChecklist(resultados);

  const porSeccion = new Map<string, typeof resultados>();
  for (const r of resultados) {
    const arr = porSeccion.get(r.item.seccion) ?? [];
    arr.push(r);
    porSeccion.set(r.item.seccion, arr);
  }

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Checklist Normativo
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            23 verificaciones de cumplimiento normativo antes de presentar
            la declaración. Las marcadas como{" "}
            <span className="font-medium">auto</span> el sistema las evalúa
            desde el estado actual; las marcadas como{" "}
            <span className="font-medium">manual</span> requieren tu
            criterio profesional.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/checklist/export?decl=${declId}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-secondary px-5 text-sm hover:bg-muted"
            title="Descarga el checklist en .xlsx con espacio para firma del revisor"
          >
            ⬇️ Exportar a Excel
          </a>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
              {empresa.razon_social}
            </p>
            <p className="font-mono text-xs">AG {declaracion.ano_gravable}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-4">
        <Stat label="Aprobadas" value={resumen.ok} color="ok" />
        <Stat label="Falla" value={resumen.fail} color="fail" />
        <Stat label="Manual" value={resumen.manual} color="manual" />
        <Stat label="No aplica" value={resumen.na} color="na" />
      </div>

      {resumen.bloqueante ? (
        <div className="mt-6 border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">Hay {resumen.fail} verificación(es) automática(s) en falla.</p>
          <p className="mt-1 text-xs">
            Resuelve estos puntos antes de presentar. Las verificaciones manuales
            son tu responsabilidad de revisión.
          </p>
        </div>
      ) : null}

      {SECCIONES_ORDEN.map((seccion) => {
        const items = porSeccion.get(seccion) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={seccion} className="mt-10">
            <div className="mb-3 flex items-baseline justify-between border-b border-border pb-1">
              <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">
                {seccion}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {SECCION_DESC[seccion]}
              </p>
            </div>
            <ul className="divide-y divide-border">
              {items.map((r) => (
                <li
                  key={r.item.id}
                  className="grid grid-cols-[24px_1fr_auto] items-start gap-3 py-2.5"
                >
                  <span className="pt-0.5 text-center">
                    <Badge estado={r.estado} />
                  </span>
                  <div>
                    <p className="text-sm">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {r.item.numero}.
                      </span>{" "}
                      <span className="font-medium">{r.item.concepto}</span>
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        {r.item.artET}
                      </span>
                      {r.item.tipo === "manual" ? (
                        <span className="ml-2 inline-block rounded-full border border-border px-1.5 text-[9px] uppercase tracking-[0.05em] text-muted-foreground">
                          manual
                        </span>
                      ) : null}
                    </p>
                    {r.detalle ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.detalle}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="mt-10 border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Cómo usarlo</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Esta página NO bloquea la presentación; es un checklist de
            cumplimiento. La firma final es tu responsabilidad profesional.
          </li>
          <li>
            Items <span className="font-medium">auto</span> · OK · falla · n/a
            según el estado actual de la declaración.
          </li>
          <li>
            Items <span className="font-medium">manual</span> · son recordatorios
            que requieren tu criterio (causalidad, factura electrónica,
            INCRNGO clasificados, etc.).
          </li>
          <li>
            Si quieres marcar manualmente cuáles ya verificaste y persistir,
            esa funcionalidad está en backlog (requiere migración).
          </li>
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "ok" | "fail" | "manual" | "na";
}) {
  const cls =
    color === "fail"
      ? "border-destructive/40 bg-destructive/5"
      : color === "ok"
        ? "border-success/40 bg-success/5"
        : color === "manual"
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border";
  return (
    <div className={`border p-4 ${cls}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-3xl tabular-nums">{value}</p>
    </div>
  );
}

function Badge({ estado }: { estado: ChecklistEstado }) {
  const cfg = {
    ok: { txt: "✓", cls: "text-success" },
    fail: { txt: "✕", cls: "text-destructive" },
    manual: { txt: "?", cls: "text-amber-600 dark:text-amber-500" },
    n_a: { txt: "—", cls: "text-muted-foreground" },
  } as const;
  const { txt, cls } = cfg[estado];
  return <span className={`font-mono text-sm font-bold ${cls}`}>{txt}</span>;
}
