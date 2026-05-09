
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTasaMinimaInputs } from "@/lib/tasa-minima-inputs";
import { loadAnexosCtx } from "@/lib/anexos-ctx";
import { computarRenglones } from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import {
  validarFormulario,
  validarF2516,
  validarCuadresF110,
  resumenValidaciones,
  type Validacion,
} from "@/engine/validaciones";
import { ultimoDigitoNit, evaluarPresentacion } from "@/engine/vencimientos";
import { aplicaTTDPorRegimen } from "@/engine/condicionales";
import { loadF2516Aggregates } from "@/lib/f2516-aggregates";
import { FinalizarButton } from "./finalizar-button";
import { ModuloHeader } from "@/components/modulo-header";

export const metadata = { title: "Validaciones" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

const CATEGORIAS: { key: Validacion["categoria"]; label: string; descripcion: string }[] = [
  { key: "configuracion", label: "Configuración", descripcion: "Ajustes de empresa y declaración." },
  { key: "cuadre", label: "Cuadre contable", descripcion: "Activos, pasivos, patrimonio, saldos." },
  { key: "fiscal", label: "Reglas fiscales", descripcion: "Topes y restricciones del Estatuto Tributario." },
  { key: "sanidad", label: "Sanidad de datos", descripcion: "Posibles errores de digitación o signo." },
  { key: "completitud", label: "Completitud", descripcion: "Datos esperados que faltan." },
  { key: "f2516", label: "Formato 2516", descripcion: "Cuadre del balance contable agregado vs renglones del 110." },
];

export default async function ValidacionesPage({
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
    .select("id, razon_social, regimen_codigo, nit")
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

  // Resolver vencimiento auto si no hay override
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

  const { data: valores } = await supabase
    .from("form110_valores")
    .select("numero, valor")
    .eq("declaracion_id", declId);

  // Totales de TODOS los anexos centralizados en loadAnexosCtx
  const anexosCtx = await loadAnexosCtx(supabase, declId, declaracion);

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

  const { data: uvtRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable + 1)
    .eq("codigo", "uvt")
    .maybeSingle();
  const uvtVigente = uvtRow ? Number(uvtRow.valor) : null;

  const patrimonioLiquidoAnterior =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);

  const presentacion =
    evaluacion.estado === "extemporanea"
      ? { estado: "extemporanea" as const, mesesExtemporanea: evaluacion.mesesExtemporanea }
      : evaluacion.estado === "oportuna"
        ? { estado: "oportuna" as const }
        : { estado: "no_presentada" as const };

  const inputs = new Map<number, number>();
  for (const v of valores ?? []) inputs.set(v.numero, normalizarSigno(v.numero, Number(v.valor)));
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
    presentacion,
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
    patrimonioLiquidoAnterior,
    esInstitucionFinanciera: !!declaracion.es_institucion_financiera,
    rentaPresuntiva,
  });

  const validacionesF110 = validarFormulario(numerico, {
    tarifaRegimen,
    regimenCodigo: empresa.regimen_codigo ?? null,
    impuestoNetoAnterior: Number(declaracion.impuesto_neto_anterior ?? 0),
    aniosDeclarando: declaracion.anios_declarando ?? "tercero_o_mas",
    presentacion,
    calculaSancionExtemporaneidad: !!declaracion.calcula_sancion_extemporaneidad,
    aplicaTasaMinima:
      aplicaTTDPorRegimen(empresa.regimen_codigo).aplica &&
      (declaracion.aplica_tasa_minima ?? true),
    beneficioAuditoria12m: !!declaracion.beneficio_auditoria_12m,
    beneficioAuditoria6m: !!declaracion.beneficio_auditoria_6m,
  });

  // Validaciones F2516 ↔ F110 (cuadre balance vs renglones)
  const filasF2516 = await loadF2516Aggregates(supabase, declId, numerico);
  const validacionesF2516 = validarF2516(filasF2516);

  // Validaciones V1-V18 oficiales del .xlsm (cruces internos del 110)
  const validacionesCuadres = validarCuadresF110(numerico, {
    totalAutorretenciones: anexosCtx.totalAutorretenciones,
    totalRetenciones: anexosCtx.totalRetenciones,
    totalDescuentosTributarios: anexosCtx.totalDescuentosTributarios,
    totalRentasExentas: anexosCtx.totalRentasExentas,
    totalCompensaciones: anexosCtx.totalCompensaciones,
    // Pérdidas fiscales acumuladas · viene del Anexo de pérdidas. Si no se
    // ha capturado, V16 no se evalúa (simplemente no genera hallazgo).
    perdidasAcumuladas: undefined,
  });

  const validaciones = [
    ...validacionesF110,
    ...validacionesCuadres,
    ...validacionesF2516,
  ];

  const resumen = resumenValidaciones(validaciones);
  const porCategoria = new Map<Validacion["categoria"], Validacion[]>();
  for (const v of validaciones) {
    const arr = porCategoria.get(v.categoria) ?? [];
    arr.push(v);
    porCategoria.set(v.categoria, arr);
  }

  return (
    <div>
      <ModuloHeader
        titulo="Validaciones"
        moduloLabel="Auditoría · 42 reglas"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}`}
        volverLabel="Editor"
        contexto={`${empresa.razon_social} · AG ${declaracion.ano_gravable} · ${declaracion.estado}`}
      />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Stat label="Errores" value={resumen.errores} alert={resumen.errores > 0} />
        <Stat label="Advertencias" value={resumen.advertencias} warn={resumen.advertencias > 0} />
        <Stat label="Informativas" value={resumen.informativas} muted />
      </div>

      <div className="mt-10">
        <FinalizarButton
          declId={declId}
          empresaId={empresaId}
          estado={declaracion.estado}
          bloqueado={resumen.bloqueante}
        />
        {resumen.bloqueante ? (
          <p className="mt-3 text-sm text-destructive">
            Tienes {resumen.errores} error{resumen.errores !== 1 ? "es" : ""} bloqueante{resumen.errores !== 1 ? "s" : ""}. Resuélvelos antes de finalizar.
          </p>
        ) : null}
      </div>

      <div className="mt-12 space-y-10">
        {CATEGORIAS.map((cat) => {
          const items = porCategoria.get(cat.key);
          if (!items || items.length === 0) return null;
          return (
            <section key={cat.key}>
              <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
                {cat.label}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{cat.descripcion}</p>
              <div className="mt-4 space-y-2">
                {items.map((vw, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
                      vw.nivel === "error"
                        ? "border-destructive/40 bg-destructive/5"
                        : vw.nivel === "warn"
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-border bg-muted/30"
                    }`}
                  >
                    <span
                      className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                        vw.nivel === "error"
                          ? "bg-destructive"
                          : vw.nivel === "warn"
                            ? "bg-amber-500"
                            : "bg-muted-foreground"
                      }`}
                    />
                    <div className="flex-1">
                      {vw.renglon ? (
                        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                          Renglón {vw.renglon} ·{" "}
                          {numerico.get(vw.renglon) !== undefined
                            ? FMT.format(numerico.get(vw.renglon)!)
                            : "—"}
                        </p>
                      ) : null}
                      <p className="mt-0.5">{vw.mensaje}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {validaciones.length === 0 ? (
          <div className="border border-success/40 bg-success/5 p-8 text-center">
            <p className="font-serif text-2xl leading-[1.1]">Todo en orden</p>
            <p className="mt-2 text-sm text-muted-foreground">
              No detectamos errores ni advertencias. Puedes finalizar la declaración.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
  warn,
  muted,
}: {
  label: string;
  value: number;
  alert?: boolean;
  warn?: boolean;
  muted?: boolean;
}) {
  const cls = alert
    ? "border-destructive/40 bg-destructive/5"
    : warn
      ? "border-amber-500/40 bg-amber-500/5"
      : "border-border";
  const valueCls = alert
    ? "text-destructive"
    : warn
      ? "text-amber-600 dark:text-amber-500"
      : muted
        ? "text-muted-foreground"
        : "";
  return (
    <div className={`border p-5 ${cls}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-3xl tracking-[-0.02em] ${valueCls}`}>{value}</p>
    </div>
  );
}
