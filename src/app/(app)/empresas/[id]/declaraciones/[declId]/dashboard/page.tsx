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
  validarFormulario,
  validarF2516,
  resumenValidaciones,
} from "@/engine/validaciones";
import { evaluarChecklist, resumenChecklist } from "@/engine/checklist";
import { evaluarObligacionPT } from "@/engine/precios-transferencia";
import { ModuloHeader } from "@/components/modulo-header";

export const metadata = { title: "Dashboard" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function DashboardPage({
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
    .select("razon_social, nit, dv, regimen_codigo, ciiu_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  // Tarifa
  let tarifaRegimen: number | null = null;
  if (empresa.regimen_codigo) {
    const { data: reg } = await supabase
      .from("regimenes_tarifas")
      .select("tarifa, descripcion")
      .eq("codigo", empresa.regimen_codigo)
      .eq("ano_gravable", declaracion.ano_gravable)
      .maybeSingle();
    tarifaRegimen = reg ? Number(reg.tarifa) : null;
  }

  // UVT
  const { data: uvtRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable + 1)
    .eq("codigo", "uvt")
    .maybeSingle();
  const uvtVigente = uvtRow ? Number(uvtRow.valor) : null;

  // Vencimiento
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

  const plAnt =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);

  // Compute
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
  });

  const r = (n: number) => numerico.get(n) ?? 0;

  // Validaciones + F2516 + Checklist
  const filasF2516 = await loadF2516Aggregates(supabase, declId, numerico);
  const valF110 = validarFormulario(numerico, {
    tarifaRegimen,
    regimenCodigo: empresa.regimen_codigo ?? null,
  });
  const valF2516 = validarF2516(filasF2516);
  const valTotal = [...valF110, ...valF2516];
  const resumenVal = resumenValidaciones(valTotal);

  const checklistRes = evaluarChecklist({
    nit: empresa.nit,
    dv: empresa.dv,
    ciiu: empresa.ciiu_codigo,
    razonSocial: empresa.razon_social,
    regimenCodigo: empresa.regimen_codigo,
    tarifaRegimen,
    numerico,
    presentacionOportuna: evaluacion.estado === "oportuna",
    ttdAplicaPorRegimen: aplicaTTDPorRegimen(empresa.regimen_codigo).aplica,
    esVinculadoSubcap: !!declaracion.sub_es_vinculado,
    codRepresentacion: declaracion.cod_representacion ?? null,
    codContadorRF: declaracion.cod_contador_rf ?? null,
    hayDescuadresF2516: valF2516.some((v) => v.nivel === "error" || v.nivel === "warn"),
    calculaAnticipo: !!declaracion.calcula_anticipo,
    aniosDeclarando: declaracion.anios_declarando as
      | "primero" | "segundo" | "tercero_o_mas" | undefined,
  });
  const resumenChk = resumenChecklist(checklistRes);

  // Counts de anexos para etapas de progreso
  const [
    { count: cntRet },
    { count: cntDesc },
    { count: cntDiv },
    { count: cntComp },
    { count: cntRE },
    { count: cntInc },
    { count: cntGo },
    { count: cntSeg },
  ] = await Promise.all([
    supabase.from("anexo_retenciones").select("*", { count: "exact", head: true }).eq("declaracion_id", declId),
    supabase.from("anexo_descuentos").select("*", { count: "exact", head: true }).eq("declaracion_id", declId),
    supabase.from("anexo_dividendos").select("*", { count: "exact", head: true }).eq("declaracion_id", declId),
    supabase.from("anexo_compensaciones").select("*", { count: "exact", head: true }).eq("declaracion_id", declId),
    supabase.from("anexo_rentas_exentas").select("*", { count: "exact", head: true }).eq("declaracion_id", declId),
    supabase.from("anexo_incrngo").select("*", { count: "exact", head: true }).eq("declaracion_id", declId),
    supabase.from("anexo_ganancia_ocasional").select("*", { count: "exact", head: true }).eq("declaracion_id", declId),
    supabase.from("anexo_seg_social").select("*", { count: "exact", head: true }).eq("declaracion_id", declId),
  ]);

  // Etapas
  const etapas = [
    { num: 1, label: "Datos del Contribuyente", href: "configuracion", completo: !!empresa.nit && !!empresa.regimen_codigo && !!empresa.ciiu_codigo, hint: "NIT, régimen, CIIU." },
    { num: 2, label: "Balance de Prueba", href: "balance", completo: r(44) > 0 || r(45) > 0, hint: "Patrimonio bruto + pasivos del balance." },
    { num: 3, label: "Nómina y Seguridad Social", href: "anexos/seguridad-social", completo: (cntSeg ?? 0) > 0 || r(33) > 0, hint: "Aportes que alimentan R33-R35." },
    { num: 4, label: "Patrimonio", href: "formulario-110", completo: r(46) > 0, hint: "R36-R46 cuadrados." },
    { num: 5, label: "Ingresos", href: "anexos", completo: r(58) > 0 || (cntInc ?? 0) > 0 || (cntDiv ?? 0) > 0, hint: "Ordinarios, dividendos, INCRNGO, exentas." },
    { num: 6, label: "Costos y Deducciones", href: "anexos", completo: r(67) > 0 || (cntDesc ?? 0) > 0, hint: "Costos, gastos, descuentos." },
    { num: 7, label: "Renta y GO", href: "formulario-110", completo: r(79) > 0 || r(83) > 0 || (cntComp ?? 0) > 0 || (cntRE ?? 0) > 0 || (cntGo ?? 0) > 0, hint: "Renta líquida gravable + ganancias ocasionales." },
    { num: 8, label: "Liquidación del Impuesto", href: "formulario-110", completo: r(99) > 0, hint: "Tarifa, descuentos, anticipo, sanciones." },
    { num: 9, label: "Retenciones", href: "anexos/retenciones", completo: (cntRet ?? 0) > 0 || r(107) > 0, hint: "Auto y otras retenciones." },
    { num: 10, label: "Conciliación y Auditoría", href: "conciliaciones", completo: !valF2516.some((v) => v.nivel === "error"), hint: "F2516, Conc Patrimonial/Utilidades, Impuesto Diferido." },
  ];
  const completos = etapas.filter((e) => e.completo).length;
  const progresoPct = Math.round((completos / etapas.length) * 100);

  // PT obligación (desde R58)
  const { data: uvtAntRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable - 1)
    .eq("codigo", "uvt")
    .maybeSingle();
  const uvtAnterior = uvtAntRow ? Number(uvtAntRow.valor) : 47_065;
  const ptOblig = evaluarObligacionPT({
    patrimonioBrutoAnterior: Number(declaracion.patrimonio_bruto_anterior ?? 0),
    ingresosBrutosActual: r(58),
    uvtAnterior,
    uvtActual: uvtVigente ?? 49_799,
  });

  const saldoPagar = r(113);
  const saldoFavor = r(114);

  return (
    <div className="max-w-6xl">
      <ModuloHeader
        titulo="Dashboard"
        moduloLabel="Resumen Ejecutivo"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}`}
        volverLabel="Editor"
        contexto={`${empresa.razon_social} · NIT ${empresa.nit ?? "—"}${empresa.dv ? `-${empresa.dv}` : ""} · AG ${declaracion.ano_gravable}`}
      />

      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Vista consolidada de la declaración: KPIs principales, progreso de
        preparación, alertas y vencimientos. Cada bloque es un cierre del
        flujo y enlaza al módulo correspondiente.
      </p>

      {/* === Datos contribuyente === */}
      <section className="mt-8 grid gap-3 md:grid-cols-3">
        <Info label="Razón social" value={empresa.razon_social} />
        <Info label="Régimen" value={empresa.regimen_codigo ?? "sin asignar"} />
        <Info
          label="Tarifa"
          value={tarifaRegimen != null ? `${(tarifaRegimen * 100).toFixed(0)}%` : "—"}
        />
        <Info label="CIIU" value={empresa.ciiu_codigo ?? "—"} />
        <Info
          label="Vencimiento"
          value={declaracion.fecha_vencimiento ?? vencimientoSugerido ?? "—"}
        />
        <Info
          label="Estado presentación"
          value={evaluacion.estado.replace("_", " ")}
          alert={evaluacion.estado === "extemporanea"}
        />
      </section>

      {/* === KPIs principales === */}
      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Resumen ejecutivo
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <KPI label="Patrimonio líquido" subLabel="R46" value={r(46)} />
          <KPI label="Renta líquida gravable" subLabel="R79" value={r(79)} />
          <KPI label="Impuesto a cargo" subLabel="R99" value={r(99)} />
          <KPI
            label={saldoPagar > 0 ? "Saldo a pagar" : "Saldo a favor"}
            subLabel={saldoPagar > 0 ? "R113" : "R114"}
            value={saldoPagar > 0 ? saldoPagar : saldoFavor}
            highlight={saldoPagar > 0 ? "alert" : "success"}
          />
        </div>
      </section>

      {/* === Progreso === */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Progreso de preparación
          </h2>
          <p className="text-sm">
            <span className="font-medium">{completos}</span> de{" "}
            <span className="font-medium">{etapas.length}</span> etapas ·{" "}
            <span className="font-mono">{progresoPct}%</span>
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-foreground"
            style={{ width: `${progresoPct}%` }}
          />
        </div>
        <ul className="mt-5 grid gap-2 md:grid-cols-2">
          {etapas.map((e) => (
            <li key={e.num} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border border-border p-3">
              <span
                className={`text-center font-mono text-sm font-bold ${
                  e.completo ? "text-success" : "text-muted-foreground"
                }`}
              >
                {e.completo ? "✓" : String(e.num).padStart(2, "0")}
              </span>
              <div>
                <p className="text-sm font-medium">{e.label}</p>
                <p className="text-xs text-muted-foreground">{e.hint}</p>
              </div>
              <Link
                href={`/empresas/${empresaId}/declaraciones/${declId}/${e.href}`}
                className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                Ir →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* === Alertas === */}
      <section className="mt-10 grid gap-3 md:grid-cols-3">
        <AlertCard
          titulo="Validaciones"
          href={`/empresas/${empresaId}/declaraciones/${declId}/validaciones`}
          counts={[
            { label: "errores", value: resumenVal.errores, level: "fail" },
            { label: "warns", value: resumenVal.advertencias, level: "warn" },
            { label: "info", value: resumenVal.informativas, level: "info" },
          ]}
        />
        <AlertCard
          titulo="Checklist Normativo"
          href={`/empresas/${empresaId}/declaraciones/${declId}/checklist`}
          counts={[
            { label: "ok", value: resumenChk.ok, level: "ok" },
            { label: "fail", value: resumenChk.fail, level: "fail" },
            { label: "manual", value: resumenChk.manual, level: "warn" },
          ]}
        />
        <AlertCard
          titulo="Precios de Transferencia"
          href={`/empresas/${empresaId}/declaraciones/${declId}/anexos/precios-transferencia`}
          counts={[
            {
              label: ptOblig.obligado ? "OBLIGADO" : "no obligado",
              value: ptOblig.obligado ? 1 : 0,
              level: ptOblig.obligado ? "fail" : "ok",
            },
          ]}
        />
      </section>

      {/* === Parámetros AG === */}
      <section className="mt-10">
        <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Parámetros tributarios AG {declaracion.ano_gravable}
        </h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <Param
            label={`UVT AG ${declaracion.ano_gravable}`}
            value={uvtAnterior ? `$${FMT.format(uvtAnterior)}` : "—"}
          />
          <Param
            label={`UVT AG ${declaracion.ano_gravable + 1} (sanciones)`}
            value={uvtVigente ? `$${FMT.format(uvtVigente)}` : "—"}
          />
          <Param
            label="Tarifa general"
            value="35%"
          />
          <Param
            label="Sanción mínima"
            value={uvtVigente ? `10 UVT · $${FMT.format(uvtVigente * 10)}` : "—"}
          />
          <Param label="Renta presuntiva" value="0% (Ley 2277)" />
          <Param label="Tasa Mínima TTD" value="15% (Ley 2277)" />
        </div>
      </section>

      {/* === Quick links === */}
      <section className="mt-10 border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Atajos de cierre</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuickLink href={`/empresas/${empresaId}/declaraciones/${declId}/formulario-110`}>
            Vista F110
          </QuickLink>
          <QuickLink href={`/empresas/${empresaId}/declaraciones/${declId}/imprimir`}>
            Imprimir vista plana
          </QuickLink>
          <QuickLink href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}>
            F2516
          </QuickLink>
          <QuickLink href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/impuesto-diferido`}>
            Impuesto Diferido
          </QuickLink>
          <QuickLink href={`/empresas/${empresaId}/declaraciones/${declId}/simulador`}>
            Simulador
          </QuickLink>
        </div>
      </section>

      {/* === Excel exports === */}
      <section className="mt-6 border border-border p-4">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          Descargas
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada bloque genera un .xlsx con encabezado del contribuyente para
          entrega formal o validación cruzada.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`/api/declaracion/form110/export?decl=${declId}`}
            className="inline-flex h-9 items-center justify-center rounded-full border border-foreground/40 bg-foreground/[0.04] px-4 text-xs font-medium hover:bg-foreground/[0.08]"
          >
            ⬇️ F110 completo
          </a>
          <a
            href={`/api/conciliaciones/formato-2516/export?decl=${declId}`}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
          >
            ⬇️ F2516
          </a>
          <a
            href={`/api/conciliaciones/impuesto-diferido/export?decl=${declId}`}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
          >
            ⬇️ Impuesto Diferido
          </a>
          <a
            href={`/api/anexos/retenciones/export?decl=${declId}`}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
          >
            ⬇️ Retenciones
          </a>
          <a
            href={`/api/anexos/seguridad-social/export?decl=${declId}`}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
          >
            ⬇️ Seguridad Social
          </a>
          <a
            href={`/api/checklist/export?decl=${declId}`}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
          >
            ⬇️ Checklist
          </a>
          <a
            href={`/api/guia/export`}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
            title="Guía completa de funcionamiento del sistema en formato Word"
          >
            📖 Guía Tribai (Word)
          </a>
        </div>
      </section>
    </div>
  );
}

function Info({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className={`border p-3 ${alert ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function KPI({
  label,
  subLabel,
  value,
  highlight,
}: {
  label: string;
  subLabel: string;
  value: number;
  highlight?: "alert" | "success";
}) {
  const cls =
    highlight === "alert"
      ? "border-destructive/40 bg-destructive/5"
      : highlight === "success"
        ? "border-success/40 bg-success/5"
        : "border-border";
  return (
    <div className={`border p-4 ${cls}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-3xl tracking-[-0.02em] tabular-nums">
        {FMT.format(value)}
      </p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        {subLabel}
      </p>
    </div>
  );
}

function AlertCard({
  titulo,
  href,
  counts,
}: {
  titulo: string;
  href: string;
  counts: { label: string; value: number; level: "ok" | "fail" | "warn" | "info" }[];
}) {
  return (
    <Link
      href={href}
      className="block border border-border p-4 transition-colors hover:border-foreground"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {titulo}
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        {counts.map((c) => {
          const colorCls =
            c.level === "fail"
              ? "text-destructive"
              : c.level === "warn"
                ? "text-amber-600 dark:text-amber-500"
                : c.level === "ok"
                  ? "text-success"
                  : "text-muted-foreground";
          return (
            <div key={c.label}>
              <p className={`font-serif text-2xl tabular-nums ${colorCls}`}>
                {c.value}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {c.label}
              </p>
            </div>
          );
        })}
      </div>
    </Link>
  );
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  );
}

function QuickLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center justify-center rounded-full border border-border-secondary px-3 text-xs hover:bg-muted"
    >
      {children}
    </Link>
  );
}
