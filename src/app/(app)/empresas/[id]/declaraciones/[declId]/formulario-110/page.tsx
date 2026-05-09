import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { ultimoDigitoNit, evaluarPresentacion } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { PrintButton } from "./print-button";

export const metadata = { title: "Formulario 110" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

// Colores DIAN (extraídos del formulario oficial)
const DIAN_BLUE = "#1B5AAB"; // azul de barras laterales y caja del "110"
const DIAN_BLUE_LIGHT = "#EAF2F9"; // azul claro para sub-encabezados

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

  // Anexos · totales (centralizado en loadAnexosCtx)
  const anexosCtx = await loadAnexosCtx(supabase, declId, declaracion);

  // Renta presuntiva
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
  const ttdInputs = await loadTasaMinimaInputs(supabase, declId, declaracion);
  const numerico = computarRenglones(inputs, {
    ...anexosCtx,
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

  // Mapa rápido descripción por número
  const descMap = new Map<number, string>();
  for (const r of renglones ?? []) descMap.set(r.numero, r.descripcion);
  const desc = (n: number, fallback?: string): string =>
    descMap.get(n) ?? fallback ?? `Renglón ${n}`;

  const v = (n: number): number => numerico.get(n) ?? 0;

  return (
    <div className="bg-white text-black mx-auto max-w-[860px] pb-32" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .formulario-dian { max-width: none !important; padding: 0 !important; }
          .renglon-row, .casilla, section { break-inside: avoid; }
        }
      `}</style>

      {/* Top bar (no print) */}
      <div className="no-print mb-4 flex items-center justify-between px-2 pt-2">
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}`}
          className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
        >
          ← Volver al editor
        </Link>
        <PrintButton />
      </div>

      <div className="formulario-dian border border-black">
        {/* ============================================================ */}
        {/* CABECERA · Logo · Título · Caja "110"                        */}
        {/* ============================================================ */}
        <div className="grid border-b border-black" style={{ gridTemplateColumns: "140px 1fr 100px" }}>
          <div className="border-r border-black p-2 flex items-center justify-center">
            <Image
              src="/brand/logo-tribai-full.svg"
              alt="Tribai"
              width={100}
              height={28}
            />
          </div>
          <div className="p-2 text-center text-[10px] leading-tight border-r border-black flex items-center justify-center">
            <p>
              Declaración de renta y complementario para personas jurídicas
              <br />
              y asimiladas y personas naturales y asimiladas no residentes
              <br />
              y sucesiones ilíquidas de causantes no residentes, o de ingresos y
              <br />
              patrimonio para entidades obligadas a declarar
            </p>
          </div>
          <div
            className="flex items-center justify-center text-white font-bold text-5xl"
            style={{ backgroundColor: DIAN_BLUE }}
          >
            110
          </div>
        </div>

        {/* ============================================================ */}
        {/* AÑO · FRACCIÓN · ESPACIO RESERVADO · NÚMERO DE FORMULARIO    */}
        {/* ============================================================ */}
        <div className="grid border-b border-black text-[10px]" style={{ gridTemplateColumns: "120px 1fr 1fr 1fr" }}>
          <div className="border-r border-black p-1.5">
            <div className="font-semibold">1. Año</div>
            <div className="mt-1 border border-black/70 px-2 py-0.5 text-center font-mono text-sm">
              {declaracion.ano_gravable}
            </div>
            <div className="mt-1 text-[9px] text-black/70">Espacio reservado para la DIAN</div>
          </div>
          <div className="border-r border-black p-1.5 flex items-start gap-2">
            <span className="text-[9px] flex-1">29. Fracción año gravable siguiente</span>
            <CheckBoxValue checked={!!declaracion.fraccion_ano_siguiente} />
          </div>
          <div className="border-r border-black p-1.5 text-[9px] text-black/40">
            (Espacio reservado para la DIAN)
          </div>
          <div className="p-1.5">
            <div className="font-semibold">4. Número de formulario</div>
            <div className="mt-1 border border-black/70 px-2 py-0.5 font-mono text-[10px] text-black/40">
              Asignado al presentar
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DATOS DEL DECLARANTE                                          */}
        {/* ============================================================ */}
        <SeccionConBarra label="Datos del declarante" altura="auto">
          <div className="grid grid-cols-12 text-[9px] border-b border-black">
            <Casilla num="5" label="No. Identificación Tributaria (NIT)" value={empresa.nit} colSpan={2} />
            <Casilla num="6" label="DV." value={empresa.dv ?? ""} colSpan={1} />
            <Casilla num="7" label="Primer apellido" value="" colSpan={2} placeholder="No aplica PJ" />
            <Casilla num="8" label="Segundo apellido" value="" colSpan={2} placeholder="No aplica PJ" />
            <Casilla num="9" label="Primer nombre" value="" colSpan={2} placeholder="No aplica PJ" />
            <Casilla num="10" label="Otros nombres" value="" colSpan={3} placeholder="No aplica PJ" />
          </div>
          <div className="grid grid-cols-12 text-[9px]">
            <Casilla num="11" label="Razón social" value={empresa.razon_social} colSpan={8} />
            <Casilla num="12" label="Cód. Direcc. Seccional" value={empresa.direccion_seccional_codigo ?? ""} colSpan={2} />
            <Casilla num="24" label="Actividad económica principal" value={empresa.ciiu_codigo ?? ""} colSpan={2} noBorderRight />
          </div>
        </SeccionConBarra>

        {/* ============================================================ */}
        {/* CORRECCIÓN · 25, 26, 30, 31                                   */}
        {/* ============================================================ */}
        <div className="grid grid-cols-12 border-b border-black text-[9px]">
          <div
            className="col-span-1 flex items-center justify-center text-white font-semibold border-r border-black"
            style={{ backgroundColor: DIAN_BLUE }}
          >
            Corrección
          </div>
          <Casilla num="25" label="Cód." value={declaracion.calcula_sancion_correccion ? "1" : ""} colSpan={1} />
          <Casilla num="26" label="No Formulario anterior" value={declaracion.numero_formulario_anterior ?? ""} colSpan={3} placeholder="—" />
          <CasillaCheck num="30" label="Renuncio a pertenecer al Régimen Tributario Especial" checked={!!declaracion.renuncio_regimen_especial} colSpan={4} />
          <CasillaCheck num="31" label="Vinculado al pago de obras por impuestos" checked={!!declaracion.vinculado_obras_impuestos} colSpan={3} noBorderRight />
        </div>

        {/* ============================================================ */}
        {/* DATOS INFORMATIVOS · 33, 34, 35                               */}
        {/* ============================================================ */}
        <div className="grid grid-cols-12 border-b border-black text-[9px]">
          <div className="col-span-1 bg-[#EAF2F9] flex items-center justify-center text-center text-[8px] font-semibold border-r border-black p-0.5">
            Datos<br />informativos
          </div>
          <CasillaNum num="33" label="Total costos y gastos de nómina" value={v(33)} colSpan={4} />
          <CasillaNum num="34" label="Aportes al sistema de seguridad social" value={v(34)} colSpan={3} />
          <CasillaNum num="35" label="Aportes al SENA, ICBF, cajas de compensación" value={v(35)} colSpan={4} noBorderRight />
        </div>

        {/* ============================================================ */}
        {/* DOS COLUMNAS: Patrimonio/Ingresos/Costos/Renta(p1) | Renta(p2)/GO/Liquidación */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2">
          {/* === COLUMNA IZQUIERDA === */}
          <div className="border-r border-black">
            <SeccionConBarra label="Patrimonio">
              {[36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46].map((n) => (
                <Renglon
                  key={n}
                  num={n}
                  descripcion={desc(n)}
                  valor={v(n)}
                  bold={n === 44 || n === 46}
                />
              ))}
            </SeccionConBarra>

            <SeccionConBarra label="Ingresos">
              {[47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61].map((n) => (
                <Renglon
                  key={n}
                  num={n}
                  descripcion={desc(n)}
                  valor={v(n)}
                  bold={n === 58 || n === 61}
                />
              ))}
            </SeccionConBarra>

            <SeccionConBarra label="Costos y deducciones">
              {[62, 63, 64, 65, 66, 67].map((n) => (
                <Renglon
                  key={n}
                  num={n}
                  descripcion={desc(n)}
                  valor={v(n)}
                  bold={n === 67}
                />
              ))}
            </SeccionConBarra>

            <SeccionConBarra label="ESAL Inv." altura="auto">
              {[68, 69].map((n) => (
                <Renglon key={n} num={n} descripcion={desc(n)} valor={v(n)} />
              ))}
            </SeccionConBarra>

            <SeccionConBarra label="Renta">
              {[70, 71, 72, 73, 74, 75, 76].map((n) => (
                <Renglon
                  key={n}
                  num={n}
                  descripcion={desc(n)}
                  valor={v(n)}
                  bold={n === 72 || n === 73 || n === 75}
                />
              ))}
            </SeccionConBarra>
          </div>

          {/* === COLUMNA DERECHA === */}
          <div>
            <SeccionConBarra label="Renta">
              {[77, 78, 79].map((n) => (
                <Renglon
                  key={n}
                  num={n}
                  descripcion={desc(n)}
                  valor={v(n)}
                  bold={n === 79}
                />
              ))}
            </SeccionConBarra>

            <SeccionConBarra label="Ganancias ocasionales">
              {[80, 81, 82, 83].map((n) => (
                <Renglon
                  key={n}
                  num={n}
                  descripcion={desc(n)}
                  valor={v(n)}
                  bold={n === 83}
                />
              ))}
            </SeccionConBarra>

            <SeccionConBarra label="Liquidación privada">
              {/* Subgrupo: Impuesto sobre las rentas líquidas gravables */}
              <SubBarra label="Impuesto sobre las rentas líquidas gravables">
                {[84, 85, 86, 87, 88, 89, 90].map((n) => (
                  <Renglon key={n} num={n} descripcion={desc(n)} valor={v(n)} small />
                ))}
              </SubBarra>

              <Renglon num={91} descripcion={desc(91)} valor={v(91)} bold />
              {[92, 93].map((n) => (
                <Renglon key={n} num={n} descripcion={desc(n)} valor={v(n)} />
              ))}

              {/* Subgrupo visual: "Impuesto neto de renta" */}
              <Renglon num={94} descripcion={desc(94)} valor={v(94)} bold />
              <Renglon num={95} descripcion={desc(95)} valor={v(95)} />
              <Renglon num={96} descripcion={desc(96)} valor={v(96)} bold />
              <Renglon num={97} descripcion={desc(97)} valor={v(97)} bold />
              <Renglon num={98} descripcion={desc(98)} valor={v(98)} />
              <Renglon num={99} descripcion={desc(99)} valor={v(99)} bold />

              {[100, 101, 102, 103, 104].map((n) => (
                <Renglon key={n} num={n} descripcion={desc(n)} valor={v(n)} />
              ))}

              {/* Subgrupo: Retenciones */}
              <SubBarra label="Retenciones">
                {[105, 106].map((n) => (
                  <Renglon key={n} num={n} descripcion={desc(n)} valor={v(n)} small />
                ))}
                <Renglon num={107} descripcion={desc(107)} valor={v(107)} bold small />
              </SubBarra>

              {[108, 109, 110].map((n) => (
                <Renglon key={n} num={n} descripcion={desc(n)} valor={v(n)} />
              ))}

              <Renglon num={111} descripcion={desc(111)} valor={v(111)} bold />
              <Renglon num={112} descripcion={desc(112)} valor={v(112)} />
              <Renglon num={113} descripcion={desc(113)} valor={v(113)} bold />
              <Renglon num={114} descripcion={desc(114)} valor={v(114)} bold />

              {[115, 116, 117].map((n) => (
                <Renglon key={n} num={n} descripcion={desc(n)} valor={v(n)} />
              ))}
            </SeccionConBarra>
          </div>
        </div>

        {/* ============================================================ */}
        {/* PIE · FIRMAS · 980 PAGO · 997 SELLO · 996 ADHESIVO            */}
        {/* ============================================================ */}
        <div className="grid border-t-2 border-black text-[9px]" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {/* Firmas */}
          <div className="border-r border-black p-2 space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">981. Cód. Representación</span>
                <span className="border border-black/70 px-2 py-0.5 min-w-[40px] text-center font-mono">
                  {declaracion.cod_representacion ?? "—"}
                </span>
              </div>
              <div className="mt-3 border-t border-black/40 pt-1 text-[8px] italic">
                Firma del declarante o de quien lo representa
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">982. Código Contador o Revisor Fiscal</span>
                <span className="border border-black/70 px-2 py-0.5 min-w-[40px] text-center font-mono">
                  {declaracion.cod_contador_rf ?? "—"}
                </span>
              </div>
              <div className="mt-3 border-t border-black/40 pt-1 flex items-center justify-between">
                <span className="text-[8px] italic">Firma Contador o Revisor Fiscal</span>
                <span className="flex items-center gap-1 text-[8px]">
                  994. Con salvedades
                  <CheckBoxValue checked={!!declaracion.con_salvedades} />
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">983. No. Tarjeta profesional</span>
                <span className="border border-black/70 px-2 py-0.5 min-w-[60px] text-center font-mono">
                  {declaracion.tarjeta_profesional ?? "—"}
                </span>
              </div>
            </div>
          </div>

          {/* 997 Sello entidad recaudadora */}
          <div className="border-r border-black p-2 flex items-center justify-center text-center text-[9px] text-black/50">
            997. Espacio exclusivo para el sello de la entidad recaudadora
          </div>

          {/* 980 Pago + 996 adhesivo */}
          <div className="flex flex-col">
            <div className="border-b border-black p-2">
              <div className="font-semibold">980. Pago total $</div>
              <div className="mt-1 border border-black/70 px-2 py-1 text-right font-mono text-sm">
                {v(113) > 0 ? FMT.format(v(113)) : "—"}
              </div>
            </div>
            <div className="flex-1 p-2 text-[8px] text-black/50 text-center flex items-center justify-center">
              996. Espacio para el número interno de la DIAN / Adhesivo
            </div>
          </div>
        </div>
      </div>

      {/* Pie con metadatos (fuera del formulario, no es parte del DIAN) */}
      <footer className="mt-4 border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="grid gap-2 md:grid-cols-3">
          <Meta label="Estado" value={declaracion.estado} />
          <Meta label="Vencimiento" value={fechaVencimientoEfectiva ?? "Sin fecha"} />
          <Meta label="Presentación" value={declaracion.fecha_presentacion ?? "—"} />
        </div>
        {evaluacion.estado === "extemporanea" ? (
          <p className="mt-2 text-destructive">
            Presentada {evaluacion.diasDiferencia} días después del vencimiento
            ({evaluacion.mesesExtemporanea} mes
            {evaluacion.mesesExtemporanea !== 1 ? "es" : ""} de extemporaneidad).
          </p>
        ) : null}
        <p className="mt-2 text-[10px] uppercase tracking-[0.08em]">
          Documento de trabajo · No oficial · Validar valores en MUISCA antes de presentar
        </p>
      </footer>
    </div>
  );
}

// ============================================================
// Helpers visuales
// ============================================================

/**
 * Sección con barra azul vertical a la izquierda con texto rotado 90° (estilo DIAN).
 */
function SeccionConBarra({
  label,
  children,
  altura = "default",
}: {
  label: string;
  children: React.ReactNode;
  altura?: "default" | "auto";
}) {
  return (
    <div className="grid border-b border-black" style={{ gridTemplateColumns: "20px 1fr" }}>
      <div
        className="flex items-center justify-center border-r border-black"
        style={{ backgroundColor: DIAN_BLUE, minHeight: altura === "auto" ? undefined : 0 }}
      >
        <span
          className="text-white font-semibold uppercase tracking-wide text-[9px] whitespace-nowrap"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {label}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Sub-barra azul claro horizontal para sub-secciones de Liquidación privada
 * ("Impuesto sobre las rentas líquidas gravables", "Retenciones").
 */
function SubBarra({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "16px 1fr" }}>
      <div
        className="flex items-center justify-center border-r border-black/70"
        style={{ backgroundColor: DIAN_BLUE_LIGHT }}
      >
        <span
          className="font-semibold text-[8px] whitespace-nowrap text-black/80"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {label}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Renglón estándar: descripción a la izquierda, número en cuadrito al centro,
 * valor monoespaciado alineado a la derecha. Bold para totales/computados.
 */
function Renglon({
  num,
  descripcion,
  valor,
  bold,
  small,
}: {
  num: number;
  descripcion: string;
  valor: number;
  bold?: boolean;
  small?: boolean;
}) {
  const showValue = valor !== 0;
  return (
    <div
      className={`renglon-row grid items-stretch border-b border-black/70 ${
        bold ? "bg-[#F5F8FB]" : ""
      } ${small ? "text-[8px]" : "text-[9px]"}`}
      style={{ gridTemplateColumns: "1fr 26px 90px" }}
    >
      <div className={`px-1.5 py-0.5 ${bold ? "font-bold" : ""} leading-tight border-r border-black/70`}>
        {descripcion}
      </div>
      <div className="flex items-center justify-center border-r border-black/70 font-mono tabular-nums text-[9px]">
        {num}
      </div>
      <div
        className={`flex items-center justify-end px-1.5 py-0.5 font-mono tabular-nums ${
          bold ? "font-bold" : ""
        } ${small ? "text-[9px]" : "text-[10px]"}`}
      >
        {showValue ? FMT.format(valor) : ""}
      </div>
    </div>
  );
}

/**
 * Casilla de texto con número arriba a la izquierda + label + valor.
 * Estilo DIAN: borde derecho separa cada casilla.
 */
function Casilla({
  num,
  label,
  value,
  colSpan,
  placeholder,
  noBorderRight,
}: {
  num: string;
  label: string;
  value: string;
  colSpan: number;
  placeholder?: string;
  noBorderRight?: boolean;
}) {
  return (
    <div
      className={`casilla p-1 ${noBorderRight ? "" : "border-r border-black/70"}`}
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <div className="flex items-baseline gap-1">
        <span className="font-semibold tabular-nums">{num}.</span>
        <span className="text-[8px] leading-tight">{label}</span>
      </div>
      {value ? (
        <div className="mt-0.5 truncate font-medium text-[10px]">{value}</div>
      ) : (
        <div className="mt-0.5 truncate italic text-black/40 text-[9px]">
          {placeholder ?? ""}
        </div>
      )}
    </div>
  );
}

/**
 * Casilla numérica · valor monoespaciado alineado a la derecha.
 */
function CasillaNum({
  num,
  label,
  value,
  colSpan,
  noBorderRight,
}: {
  num: string;
  label: string;
  value: number;
  colSpan: number;
  noBorderRight?: boolean;
}) {
  return (
    <div
      className={`casilla p-1 ${noBorderRight ? "" : "border-r border-black/70"}`}
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <div className="flex items-baseline gap-1">
        <span className="font-semibold tabular-nums">{num}.</span>
        <span className="text-[8px] leading-tight">{label}</span>
      </div>
      <div className="mt-0.5 font-mono tabular-nums text-right text-[10px]">
        {value === 0 ? "" : FMT.format(value)}
      </div>
    </div>
  );
}

/**
 * Casilla con checkbox (Sí/No).
 */
function CasillaCheck({
  num,
  label,
  checked,
  colSpan,
  noBorderRight,
}: {
  num: string;
  label: string;
  checked: boolean;
  colSpan: number;
  noBorderRight?: boolean;
}) {
  return (
    <div
      className={`casilla p-1 flex items-start gap-1.5 ${noBorderRight ? "" : "border-r border-black/70"}`}
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <span className="font-semibold tabular-nums text-[9px]">{num}.</span>
      <span className="flex-1 text-[8px] leading-tight">{label}</span>
      <CheckBoxValue checked={checked} />
    </div>
  );
}

function CheckBoxValue({ checked }: { checked: boolean }) {
  return (
    <span
      className="inline-block w-5 h-5 border border-black/70 flex-shrink-0 flex items-center justify-center text-[10px] font-bold leading-none"
      aria-label={checked ? "Sí" : "No"}
    >
      {checked ? "X" : ""}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  );
}
