import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RENGLONES_COMPUTADOS,
  FORMULAS_LEYENDA,
  computarRenglones,
} from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { ultimoDigitoNit, evaluarPresentacion } from "@/engine/vencimientos";
import { PrintButton } from "./print-button";

export const metadata = { title: "Formulario 110" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function Formulario110Page({
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
    .select(
      "id, razon_social, nit, dv, regimen_codigo, ciiu_codigo, direccion_seccional_codigo",
    )
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

  const [{ data: renglones }, { data: valores }] = await Promise.all([
    supabase
      .from("form110_renglones")
      .select("numero, descripcion, seccion")
      .eq("ano_gravable", declaracion.ano_gravable)
      .order("numero"),
    supabase
      .from("form110_valores")
      .select("numero, valor")
      .eq("declaracion_id", declId),
  ]);

  // Vencimiento + UVT
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
  const fechaVencimientoEfectiva =
    declaracion.fecha_vencimiento ?? vencimientoSugerido;
  const evaluacion = evaluarPresentacion(
    fechaVencimientoEfectiva,
    declaracion.fecha_presentacion,
  );

  const { data: uvtRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable + 1)
    .eq("codigo", "uvt")
    .maybeSingle();
  const uvtVigente = uvtRow ? Number(uvtRow.valor) : null;

  // Anexos · totales
  const [
    { data: retenciones },
    { data: descuentos },
    { data: gos },
    { data: rentasExentas },
    { data: compensaciones },
    { data: recups },
    { data: incrngos },
    { data: divs },
  ] = await Promise.all([
    supabase
      .from("anexo_retenciones")
      .select("tipo, retenido")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_descuentos")
      .select("valor_descuento")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_ganancia_ocasional")
      .select("precio_venta, costo_fiscal, no_gravada")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_rentas_exentas")
      .select("valor_fiscal")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_compensaciones")
      .select("compensar")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_recuperaciones")
      .select("valor")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_incrngo")
      .select("valor")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_dividendos")
      .select(
        "no_constitutivos, distribuidos_no_residentes, gravados_tarifa_general, gravados_persona_natural_dos, gravados_personas_extranjeras, gravados_art_245, gravados_tarifa_l1819, gravados_proyectos",
      )
      .eq("declaracion_id", declId),
  ]);

  const totalAutorretenciones = (retenciones ?? [])
    .filter((r) => r.tipo === "autorretencion")
    .reduce((s, r) => s + Number(r.retenido), 0);
  const totalRetenciones = (retenciones ?? [])
    .filter((r) => r.tipo === "retencion")
    .reduce((s, r) => s + Number(r.retenido), 0);
  const totalDescuentosTributarios = (descuentos ?? []).reduce(
    (s, d) => s + Number(d.valor_descuento),
    0,
  );
  const goIngresos = (gos ?? []).reduce((s, g) => s + Number(g.precio_venta), 0);
  const goCostos = (gos ?? []).reduce((s, g) => s + Number(g.costo_fiscal), 0);
  const goNoGravada = (gos ?? []).reduce((s, g) => s + Number(g.no_gravada), 0);
  const totalRentasExentas = (rentasExentas ?? []).reduce(
    (s, r) => s + Number(r.valor_fiscal),
    0,
  );
  const totalCompensaciones = (compensaciones ?? []).reduce(
    (s, c) => s + Number(c.compensar),
    0,
  );
  const totalRecuperaciones = (recups ?? []).reduce(
    (s, r) => s + Number(r.valor),
    0,
  );
  const totalIncrngo = (incrngos ?? []).reduce((s, i) => s + Number(i.valor), 0);
  const dividendos = {
    r49: (divs ?? []).reduce((s, d) => s + Number(d.no_constitutivos), 0),
    r50: (divs ?? []).reduce((s, d) => s + Number(d.distribuidos_no_residentes), 0),
    r51: (divs ?? []).reduce((s, d) => s + Number(d.gravados_tarifa_general), 0),
    r52: (divs ?? []).reduce((s, d) => s + Number(d.gravados_persona_natural_dos), 0),
    r53: (divs ?? []).reduce((s, d) => s + Number(d.gravados_personas_extranjeras), 0),
    r54: (divs ?? []).reduce((s, d) => s + Number(d.gravados_art_245), 0),
    r55: (divs ?? []).reduce((s, d) => s + Number(d.gravados_tarifa_l1819), 0),
    r56: (divs ?? []).reduce((s, d) => s + Number(d.gravados_proyectos), 0),
  };

  // Renta presuntiva (Anexo 1)
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

  // Compute all renglones
  const inputs = new Map<number, number>();
  for (const v of valores ?? []) {
    inputs.set(v.numero, normalizarSigno(v.numero, Number(v.valor)));
  }
  const numerico = computarRenglones(inputs, {
    tarifaRegimen: tarifaRegimen ?? undefined,
    impuestoNetoAnterior: Number(declaracion.impuesto_neto_anterior ?? 0),
    aniosDeclarando: declaracion.anios_declarando as
      | "primero"
      | "segundo"
      | "tercero_o_mas"
      | undefined,
    presentacion:
      evaluacion.estado === "extemporanea"
        ? { estado: "extemporanea", mesesExtemporanea: evaluacion.mesesExtemporanea }
        : evaluacion.estado === "oportuna"
          ? { estado: "oportuna" }
          : { estado: "no_presentada" },
    calculaSancionExtemporaneidad: !!declaracion.calcula_sancion_extemporaneidad,
    calculaSancionCorreccion: !!declaracion.calcula_sancion_correccion,
    mayorValorCorreccion: Number(declaracion.mayor_valor_correccion ?? 0),
    existeEmplazamiento: !!declaracion.existe_emplazamiento,
    reduccionSancion: (declaracion.reduccion_sancion ?? "0") as "0" | "50" | "75",
    uvtVigente: uvtVigente ?? undefined,
    patrimonioLiquidoAnterior: plAnt,
    esInstitucionFinanciera: !!declaracion.es_institucion_financiera,
    totalNomina: Number(declaracion.total_nomina ?? 0),
    aportesSegSocial: Number(declaracion.aportes_seg_social ?? 0),
    aportesParaFiscales: Number(declaracion.aportes_para_fiscales ?? 0),
    totalAutorretenciones,
    totalRetenciones,
    totalDescuentosTributarios,
    goIngresos,
    goCostos,
    goNoGravada,
    totalRentasExentas,
    totalCompensaciones,
    totalRecuperaciones,
    rentaPresuntiva,
    totalIncrngo,
    dividendos,
  });

  // Mapa rápido descripción por número
  const desc = (n: number): string =>
    (renglones ?? []).find((r) => r.numero === n)?.descripcion ?? `Renglón ${n}`;

  // Filtrado por sección, en orden de renglón
  const seccion = (s: string) =>
    (renglones ?? [])
      .filter((r) => r.seccion === s)
      .sort((a, b) => a.numero - b.numero);

  const patrimonio = seccion("Patrimonio");
  const ingresos = seccion("Ingresos");
  const costos = seccion("Costos y deducciones");
  const renta = seccion("Renta");
  const ganancias = seccion("Ganancias ocasionales");
  const liquidacion = seccion("Liquidación privada");

  // Subgrupos de "Liquidación privada" según el formulario oficial DIAN
  const subgrupos: { titulo: string; rangos: number[] }[] = [
    { titulo: "Impuesto sobre las rentas líquidas gravables", rangos: [84, 85, 86, 87, 88, 89, 90, 91] },
    { titulo: "Determinación del impuesto neto de renta", rangos: [92, 93, 94, 95, 96] },
    { titulo: "Impuesto a cargo", rangos: [97, 98, 99] },
    { titulo: "Reductores del impuesto", rangos: [100, 101, 102, 103, 104] },
    { titulo: "Retenciones", rangos: [105, 106, 107] },
    { titulo: "Anticipos", rangos: [108, 109, 110] },
    { titulo: "Saldo final", rangos: [111, 112, 113, 114] },
    { titulo: "Información complementaria", rangos: [115, 116, 117] },
  ];

  return (
    <div className="formulario-110 mx-auto max-w-[820px] pb-32">
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .formulario-110 { max-width: none !important; padding: 0 !important; }
          .renglon-row, .casilla { break-inside: avoid; }
        }
      `}</style>

      {/* Top bar (no print) */}
      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}`}
          className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
        >
          ← Volver al editor
        </Link>
        <PrintButton />
      </div>

      {/* Cabecera oficial */}
      <header className="border border-foreground">
        <div className="flex items-stretch">
          <div className="flex w-32 shrink-0 items-center justify-center border-r border-foreground bg-muted/50 p-3">
            <Image
              src="/brand/logo-tribai-full.svg"
              alt="Tribai"
              width={88}
              height={22}
            />
          </div>
          <div className="flex-1 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Formulario
            </p>
            <h1 className="mt-0.5 font-serif text-2xl leading-none tracking-[-0.01em]">
              110
            </h1>
            <p className="mt-1 text-xs leading-tight">
              Declaración de Renta y Complementarios o de Ingresos y Patrimonio para
              Personas Jurídicas y Asimiladas, y Personas Naturales y Asimiladas no
              Residentes y Sucesiones Ilíquidas de Causantes no Residentes
            </p>
          </div>
          <div className="flex w-28 shrink-0 flex-col items-center justify-center border-l border-foreground bg-muted/50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Año gravable
            </p>
            <p className="mt-1 font-mono text-3xl tracking-tight">
              {declaracion.ano_gravable}
            </p>
          </div>
        </div>

        {/* Casilla 4 · Número de formulario (DIAN asigna al presentar) */}
        <div className="grid grid-cols-12 gap-px border-t border-foreground bg-border text-xs">
          <CasillaText
            num="1"
            label="Año"
            value={String(declaracion.ano_gravable)}
            colSpan={2}
          />
          <CasillaText
            num="4"
            label="Número de formulario"
            value="—"
            colSpan={5}
            placeholder="Asignado por DIAN al presentar"
          />
          <CasillaText
            num="—"
            label="Tipo de contribuyente"
            value={declaracion.es_gran_contribuyente ? "Gran contribuyente" : "Persona jurídica"}
            colSpan={5}
          />
        </div>
      </header>

      {/* Identificación del declarante */}
      <section className="border-x border-b border-foreground">
        <SectionTitle>Datos del declarante</SectionTitle>
        <div className="grid grid-cols-12 gap-px bg-border text-xs">
          <CasillaText num="5" label="Identificación tributaria (NIT)" value={empresa.nit} colSpan={5} />
          <CasillaText num="6" label="DV" value={empresa.dv ?? "—"} colSpan={1} />
          <CasillaText
            num="12"
            label="Cód. Dir. Seccional"
            value={empresa.direccion_seccional_codigo ?? "—"}
            colSpan={3}
          />
          <CasillaText
            num="24"
            label="Actividad económica (CIIU)"
            value={empresa.ciiu_codigo ?? "—"}
            colSpan={3}
          />
          <CasillaText num="7" label="Primer apellido" value="" colSpan={3} placeholder="No aplica para PJ" />
          <CasillaText num="8" label="Segundo apellido" value="" colSpan={3} placeholder="No aplica para PJ" />
          <CasillaText num="9" label="Primer nombre" value="" colSpan={3} placeholder="No aplica para PJ" />
          <CasillaText num="10" label="Otros nombres" value="" colSpan={3} placeholder="No aplica para PJ" />
          <CasillaText num="11" label="Razón social" value={empresa.razon_social} colSpan={9} />
          <CasillaText
            num="—"
            label="Régimen"
            value={
              empresa.regimen_codigo
                ? `${empresa.regimen_codigo}${tarifaRegimen != null ? ` · ${(tarifaRegimen * 100).toFixed(2)}%` : ""}`
                : "Sin configurar"
            }
            colSpan={3}
          />
        </div>

        {/* Si es corrección + flags 25-31 */}
        <div className="grid grid-cols-12 gap-px border-t border-foreground bg-border text-xs">
          <CasillaText
            num="25"
            label="Si es corrección · cód."
            value={declaracion.calcula_sancion_correccion ? "1 (corrección)" : "—"}
            colSpan={3}
          />
          <CasillaText
            num="26"
            label="Nro. formulario anterior"
            value=""
            colSpan={3}
            placeholder="Por configurar"
          />
          <CasillaText
            num="29"
            label="Fracción año gravable siguiente"
            value=""
            colSpan={2}
            placeholder="Por configurar"
          />
          <CasillaText
            num="30"
            label="Renunció a régimen tributario especial"
            value=""
            colSpan={2}
            placeholder="Por configurar"
          />
          <CasillaText
            num="31"
            label="Vinculado a obras por impuestos"
            value=""
            colSpan={2}
            placeholder="Por configurar"
          />
        </div>
      </section>

      {/* Datos informativos numéricos · pérdidas + nómina */}
      <section className="border-x border-b border-foreground">
        <SectionTitle>Datos informativos</SectionTitle>
        <RenglonRow
          numero={32}
          descripcion={desc(32)}
          valor={Number(declaracion.perdidas_fiscales_acumuladas ?? 0)}
        />
        <RenglonRow
          numero={33}
          descripcion={desc(33)}
          valor={numerico.get(33) ?? 0}
          computado
        />
        <RenglonRow
          numero={34}
          descripcion={desc(34)}
          valor={numerico.get(34) ?? 0}
          computado
        />
        <RenglonRow
          numero={35}
          descripcion={desc(35)}
          valor={numerico.get(35) ?? 0}
          computado
        />
      </section>

      {/* Secciones numéricas simples */}
      <FormSection titulo="Patrimonio" items={patrimonio} numerico={numerico} />
      <FormSection titulo="Ingresos" items={ingresos} numerico={numerico} />
      <FormSection titulo="Costos y deducciones" items={costos} numerico={numerico} />
      <FormSection titulo="Renta" items={renta} numerico={numerico} />
      <FormSection titulo="Ganancias ocasionales" items={ganancias} numerico={numerico} />

      {/* Liquidación privada con subgrupos */}
      <section className="border-x border-b border-foreground">
        <SectionTitle>Liquidación privada</SectionTitle>
        {subgrupos.map((sg) => {
          const items = liquidacion.filter((r) => sg.rangos.includes(r.numero));
          if (items.length === 0) return null;
          return (
            <div key={sg.titulo}>
              <SubgrupoTitle>{sg.titulo}</SubgrupoTitle>
              {items.map((r) => (
                <RenglonRow
                  key={r.numero}
                  numero={r.numero}
                  descripcion={r.descripcion}
                  valor={numerico.get(r.numero) ?? 0}
                  computado={RENGLONES_COMPUTADOS.has(r.numero)}
                />
              ))}
            </div>
          );
        })}
      </section>

      {/* Firma · Con salvedades */}
      <section className="border-x border-b border-foreground">
        <SectionTitle>Firma del declarante / Revisor fiscal o Contador</SectionTitle>
        <div className="grid grid-cols-12 gap-px bg-border text-xs">
          <CasillaText num="981" label="Cód. representación" value="" colSpan={3} placeholder="Por configurar" />
          <CasillaText num="982" label="Cód. contador / RF" value="" colSpan={3} placeholder="Por configurar" />
          <CasillaText num="994" label="Con salvedades" value="" colSpan={3} placeholder="Por configurar" />
          <CasillaText num="983" label="No. tarjeta profesional" value="" colSpan={3} placeholder="Por configurar" />
        </div>
      </section>

      {/* Pie con datos del estado y fechas */}
      <footer className="mt-8 border border-foreground bg-muted/30 p-4 text-xs">
        <div className="grid gap-3 md:grid-cols-3">
          <Meta label="Estado" value={declaracion.estado} />
          <Meta label="Vencimiento" value={fechaVencimientoEfectiva ?? "Sin fecha"} />
          <Meta
            label="Presentación"
            value={declaracion.fecha_presentacion ?? "—"}
          />
        </div>
        {evaluacion.estado === "extemporanea" ? (
          <p className="mt-3 text-destructive">
            Presentada {evaluacion.diasDiferencia} días después del vencimiento
            ({evaluacion.mesesExtemporanea} mes
            {evaluacion.mesesExtemporanea !== 1 ? "es" : ""} de extemporaneidad).
          </p>
        ) : null}
        <p className="mt-3 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Documento de trabajo · No oficial · Validar valores en MUISCA antes de presentar
        </p>
      </footer>
    </div>
  );
}

// ============================================================
// Helpers visuales
// ============================================================

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-foreground bg-foreground px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-background">
      {children}
    </h2>
  );
}

function SubgrupoTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-border bg-muted/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </h3>
  );
}

function FormSection({
  titulo,
  items,
  numerico,
}: {
  titulo: string;
  items: { numero: number; descripcion: string }[];
  numerico: Map<number, number>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="border-x border-b border-foreground">
      <SectionTitle>{titulo}</SectionTitle>
      {items.map((r) => (
        <RenglonRow
          key={r.numero}
          numero={r.numero}
          descripcion={r.descripcion}
          valor={numerico.get(r.numero) ?? 0}
          computado={RENGLONES_COMPUTADOS.has(r.numero)}
        />
      ))}
    </section>
  );
}

function RenglonRow({
  numero,
  descripcion,
  valor,
  computado,
}: {
  numero: number;
  descripcion: string | undefined;
  valor: number;
  computado?: boolean;
}) {
  const formula = FORMULAS_LEYENDA[numero];
  const padded = String(numero).padStart(3, "0");
  return (
    <div
      className={`renglon-row flex items-stretch border-t border-border text-xs first:border-t-0 ${
        computado ? "bg-muted/40" : ""
      }`}
    >
      <div className="flex w-12 shrink-0 items-center justify-center border-r border-border font-mono text-[11px] tabular-nums text-muted-foreground">
        {padded}
      </div>
      <div className="flex flex-1 items-center px-3 py-1.5">
        <p className="leading-tight">
          {descripcion ?? `Renglón ${numero}`}
          {formula ? (
            <span
              title={formula}
              className="ml-2 cursor-help font-mono text-[10px] text-muted-foreground"
            >
              ({formula})
            </span>
          ) : null}
        </p>
      </div>
      <div
        className={`flex w-36 shrink-0 items-center justify-end border-l border-border px-3 py-1.5 font-mono tabular-nums ${
          computado ? "font-semibold" : ""
        }`}
      >
        {valor === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          FMT.format(valor)
        )}
      </div>
    </div>
  );
}

function CasillaText({
  num,
  label,
  value,
  colSpan,
  placeholder,
}: {
  num: string;
  label: string;
  value: string;
  colSpan: number;
  placeholder?: string;
}) {
  return (
    <div
      className="casilla bg-card p-2"
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {num}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.05em] text-muted-foreground">
          {label}
        </span>
      </div>
      {value ? (
        <p className="mt-0.5 truncate font-medium">{value}</p>
      ) : (
        <p className="mt-0.5 truncate text-muted-foreground/70 italic">
          {placeholder ?? "—"}
        </p>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
