import Image from "next/image";
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
import { F2516_FILAS } from "@/engine/f2516";
import { PrintButton } from "../../../formulario-110/print-button";

export const metadata = { title: "Formato 2516 · Vista oficial" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

// Colores oficiales DIAN (mismos que el F110 oficial)
const DIAN_BLUE = "#1B5AAB";
const DIAN_BLUE_LIGHT = "#EAF2F9";

export default async function Formato2516OficialPage({
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
    .select("id, razon_social, nit, dv, regimen_codigo, ciiu_codigo, direccion_seccional_codigo")
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

  const filas = await loadF2516Aggregates(supabase, declId, numerico);

  // Agrupar por sección
  const porSeccion = new Map<string, typeof filas>();
  for (const f of filas) {
    const arr = porSeccion.get(f.fila.seccion) ?? [];
    arr.push(f);
    porSeccion.set(f.fila.seccion, arr);
  }

  return (
    <div
      className="bg-white text-black mx-auto max-w-[920px] pb-32"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
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
          href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
          className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
        >
          ← Volver al editor F2516
        </Link>
        <PrintButton />
      </div>

      <div className="formulario-dian border border-black">
        {/* ============================================================ */}
        {/* CABECERA · Logo · Título · Caja "2516"                       */}
        {/* ============================================================ */}
        <div
          className="grid border-b border-black"
          style={{ gridTemplateColumns: "140px 1fr 100px" }}
        >
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
              Reporte de conciliación fiscal
              <br />
              Anexo Formulario 110
              <br />
              <strong>Resolución DIAN 071 de 2019</strong>
              <br />
              Estado de Situación Financiera + Estado de Resultado Integral
            </p>
          </div>
          <div
            className="flex items-center justify-center text-white font-bold text-4xl"
            style={{ backgroundColor: DIAN_BLUE }}
          >
            2516
          </div>
        </div>

        {/* ============================================================ */}
        {/* AÑO Y NÚMERO DE FORMULARIO                                    */}
        {/* ============================================================ */}
        <div
          className="grid border-b border-black text-[10px]"
          style={{ gridTemplateColumns: "120px 1fr 1fr 1fr" }}
        >
          <div className="border-r border-black p-1.5">
            <div className="font-semibold">1. Año</div>
            <div className="mt-1 border border-black/70 px-2 py-0.5 text-center font-mono text-sm">
              {declaracion.ano_gravable}
            </div>
          </div>
          <div className="border-r border-black p-1.5 text-[9px]">
            <div className="font-semibold">3. Periodo</div>
            <div className="mt-1 text-[9px]">Anual · 1-ene a 31-dic</div>
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
            <Casilla
              num="5"
              label="No. Identificación Tributaria (NIT)"
              value={empresa.nit}
              colSpan={2}
            />
            <Casilla num="6" label="DV." value={empresa.dv ?? ""} colSpan={1} />
            <Casilla
              num="7"
              label="Primer apellido"
              value=""
              colSpan={2}
              placeholder="No aplica PJ"
            />
            <Casilla
              num="8"
              label="Segundo apellido"
              value=""
              colSpan={2}
              placeholder="No aplica PJ"
            />
            <Casilla
              num="9"
              label="Primer nombre"
              value=""
              colSpan={2}
              placeholder="No aplica PJ"
            />
            <Casilla
              num="10"
              label="Otros nombres"
              value=""
              colSpan={3}
              placeholder="No aplica PJ"
              noBorderRight
            />
          </div>
          <div className="grid grid-cols-12 text-[9px]">
            <Casilla
              num="11"
              label="Razón social"
              value={empresa.razon_social}
              colSpan={8}
            />
            <Casilla
              num="12"
              label="Cód. Direcc. Seccional"
              value={empresa.direccion_seccional_codigo ?? ""}
              colSpan={2}
            />
            <Casilla
              num="24"
              label="Actividad económica principal"
              value={empresa.ciiu_codigo ?? ""}
              colSpan={2}
              noBorderRight
            />
          </div>
        </SeccionConBarra>

        {/* ============================================================ */}
        {/* HEADER DE COLUMNAS                                            */}
        {/* ============================================================ */}
        <div
          className="grid border-b-2 border-black text-[9px] font-bold uppercase tracking-wide"
          style={{
            gridTemplateColumns: "32px 280px 1fr 1fr 1fr 1fr 1fr 70px",
            backgroundColor: DIAN_BLUE_LIGHT,
          }}
        >
          <div className="border-r border-black px-1 py-1.5 text-center">#</div>
          <div className="border-r border-black px-2 py-1.5">Concepto</div>
          <div className="border-r border-black px-2 py-1.5 text-right">
            Contable
          </div>
          <div className="border-r border-black px-2 py-1.5 text-right">
            Conversión
          </div>
          <div className="border-r border-black px-2 py-1.5 text-right">
            Menor Fiscal
          </div>
          <div className="border-r border-black px-2 py-1.5 text-right">
            Mayor Fiscal
          </div>
          <div
            className="border-r border-black px-2 py-1.5 text-right text-white"
            style={{ backgroundColor: DIAN_BLUE }}
          >
            Fiscal
          </div>
          <div className="px-1 py-1.5 text-center text-[8px]">F110</div>
        </div>

        {/* ============================================================ */}
        {/* SECCIONES                                                     */}
        {/* ============================================================ */}
        {Array.from(porSeccion.entries()).map(([seccion, items]) => (
          <SeccionConBarra key={seccion} label={seccion} altura="auto">
            {items.map((it) => (
              <FilaOficial key={it.fila.id} it={it} />
            ))}
          </SeccionConBarra>
        ))}

        {/* ============================================================ */}
        {/* PIE · FIRMAS                                                  */}
        {/* ============================================================ */}
        <div
          className="grid border-t-2 border-black text-[9px]"
          style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
        >
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
                <span className="font-semibold">
                  982. Código Contador o Revisor Fiscal
                </span>
                <span className="border border-black/70 px-2 py-0.5 min-w-[40px] text-center font-mono">
                  {declaracion.cod_contador_rf ?? "—"}
                </span>
              </div>
              <div className="mt-3 border-t border-black/40 pt-1 text-[8px] italic">
                Firma Contador o Revisor Fiscal
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

          <div className="border-r border-black p-2 flex items-center justify-center text-center text-[9px] text-black/50">
            997. Espacio exclusivo para sello de la entidad recaudadora
          </div>

          <div className="flex flex-col">
            <div className="border-b border-black p-2">
              <div className="font-semibold text-[9px]">
                Total filas conciliadas
              </div>
              <div className="mt-1 border border-black/70 px-2 py-1 text-right font-mono text-sm">
                {F2516_FILAS.length}
              </div>
            </div>
            <div className="flex-1 p-2 text-[8px] text-black/50 text-center flex items-center justify-center">
              996. Espacio para el número interno de la DIAN / Adhesivo
            </div>
          </div>
        </div>
      </div>

      {/* Pie con metadatos (fuera del formulario) */}
      <footer className="mt-4 border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="grid gap-2 md:grid-cols-3">
          <Meta label="AG" value={String(declaracion.ano_gravable)} />
          <Meta label="Estado" value={declaracion.estado} />
          <Meta
            label="Fórmula"
            value="Fiscal = Contable + Conversión − Menor + Mayor"
          />
        </div>
        <p className="mt-2 text-[10px] uppercase tracking-[0.08em]">
          Documento de trabajo · No oficial · Validar valores en MUISCA antes de
          presentar · Resolución DIAN 071/2019
        </p>
      </footer>
    </div>
  );
}

// ============================================================
// Helpers visuales (mismos del Formulario 110)
// ============================================================

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
    <div
      className="grid border-b border-black"
      style={{ gridTemplateColumns: "20px 1fr" }}
    >
      <div
        className="flex items-center justify-center border-r border-black"
        style={{
          backgroundColor: DIAN_BLUE,
          minHeight: altura === "auto" ? undefined : 0,
        }}
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

type FilaCalc = Awaited<ReturnType<typeof loadF2516Aggregates>>[number];

function FilaOficial({ it }: { it: FilaCalc }) {
  const dif = it.diferencia;
  const cuadra = dif !== null && Math.abs(dif) <= 1000;
  const esTotal = !!it.fila.esTotal;
  return (
    <div
      className={`renglon-row grid items-stretch border-b border-black/70 text-[9px] ${
        esTotal ? "bg-[#F5F8FB] font-bold" : ""
      }`}
      style={{ gridTemplateColumns: "32px 280px 1fr 1fr 1fr 1fr 1fr 70px" }}
    >
      <div className="flex items-center justify-center border-r border-black/70 font-mono tabular-nums">
        {it.fila.numero}
      </div>
      <div className="px-2 py-0.5 leading-tight border-r border-black/70">
        {it.fila.label}
      </div>
      <div className="flex items-center justify-end px-2 font-mono tabular-nums border-r border-black/70">
        {fmtN(it.contable)}
      </div>
      <div className="flex items-center justify-end px-2 font-mono tabular-nums border-r border-black/70">
        {esTotal ? "" : fmtN(it.conversion)}
      </div>
      <div className="flex items-center justify-end px-2 font-mono tabular-nums border-r border-black/70">
        {esTotal ? "" : fmtN(it.menorFiscal)}
      </div>
      <div className="flex items-center justify-end px-2 font-mono tabular-nums border-r border-black/70">
        {esTotal ? "" : fmtN(it.mayorFiscal)}
      </div>
      <div
        className="flex items-center justify-end px-2 font-mono tabular-nums border-r border-black/70 font-bold"
        style={{ backgroundColor: cuadra ? "#F0F8F0" : "" }}
      >
        {fmtN(it.fiscal)}
      </div>
      <div className="flex items-center justify-center px-1 text-[8px] font-mono">
        {it.fila.cuadraConR110 ? `R${it.fila.cuadraConR110}` : ""}
      </div>
    </div>
  );
}

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

function fmtN(n: number): string {
  return n === 0 ? "" : FMT.format(n);
}
