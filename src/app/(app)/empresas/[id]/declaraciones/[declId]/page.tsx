import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeclaracionEditor } from "./editor";
import { ModePicker } from "./mode-picker";
import { clearModoCargaAction } from "./actions";
import { ultimoDigitoNit, evaluarPresentacion } from "@/lib/forms/vencimientos";

export const metadata = { title: "Editor declaración" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function DeclaracionEditorPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("*, empresa:empresas(id, razon_social, nit, regimen_codigo)")
    .eq("id", declId)
    .single();

  if (!declaracion) notFound();

  // Tarifa del régimen para calcular renglón 84 automaticamente
  const regimenCodigo = declaracion.empresa?.regimen_codigo;
  let tarifaRegimen: number | null = null;
  if (regimenCodigo) {
    const { data: reg } = await supabase
      .from("regimenes_tarifas")
      .select("tarifa")
      .eq("codigo", regimenCodigo)
      .eq("ano_gravable", declaracion.ano_gravable)
      .maybeSingle();
    tarifaRegimen = reg ? Number(reg.tarifa) : null;
  }

  // UVT del año de presentación (año gravable + 1) para sanciones
  const anoPresentacion = declaracion.ano_gravable + 1;
  const { data: uvtRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", anoPresentacion)
    .eq("codigo", "uvt")
    .maybeSingle();
  const uvtVigente = uvtRow ? Number(uvtRow.valor) : null;

  // Resolver vencimiento por NIT (auto)
  const tipoContribuyente = declaracion.es_gran_contribuyente
    ? "gran_contribuyente"
    : "persona_juridica";
  const digito = ultimoDigitoNit(declaracion.empresa?.nit ?? null);
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
  const fechaVencimientoEfectiva = declaracion.fecha_vencimiento ?? vencimientoSugerido;
  const evaluacion = evaluarPresentacion(
    fechaVencimientoEfectiva,
    declaracion.fecha_presentacion,
  );

  const patrimonioLiquidoAnterior =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);

  // Totales del Anexo 3 (renglones 105 y 106)
  const { data: retenciones } = await supabase
    .from("anexo_retenciones")
    .select("tipo, retenido")
    .eq("declaracion_id", declId);
  const totalAutorretenciones =
    (retenciones ?? [])
      .filter((r) => r.tipo === "autorretencion")
      .reduce((s, r) => s + Number(r.retenido), 0);
  const totalRetenciones =
    (retenciones ?? [])
      .filter((r) => r.tipo === "retencion")
      .reduce((s, r) => s + Number(r.retenido), 0);

  // Total Anexo 4 · Descuentos tributarios → renglón 93
  const { data: descuentos } = await supabase
    .from("anexo_descuentos")
    .select("valor_descuento")
    .eq("declaracion_id", declId);
  const totalDescuentosTributarios = (descuentos ?? []).reduce(
    (s, d) => s + Number(d.valor_descuento),
    0,
  );

  // Anexo 8 · Ganancia Ocasional → renglones 80, 81, 82
  const { data: gos } = await supabase
    .from("anexo_ganancia_ocasional")
    .select("precio_venta, costo_fiscal, no_gravada")
    .eq("declaracion_id", declId);
  const goIngresos = (gos ?? []).reduce((s, g) => s + Number(g.precio_venta), 0);
  const goCostos = (gos ?? []).reduce((s, g) => s + Number(g.costo_fiscal), 0);
  const goNoGravada = (gos ?? []).reduce((s, g) => s + Number(g.no_gravada), 0);

  // Anexo 19 · Rentas Exentas → R77
  const { data: rentasExentas } = await supabase
    .from("anexo_rentas_exentas")
    .select("valor_fiscal")
    .eq("declaracion_id", declId);
  const totalRentasExentas = (rentasExentas ?? []).reduce(
    (s, r) => s + Number(r.valor_fiscal),
    0,
  );

  // Anexo 20 · Compensaciones → R74
  const { data: compensaciones } = await supabase
    .from("anexo_compensaciones")
    .select("compensar")
    .eq("declaracion_id", declId);
  const totalCompensaciones = (compensaciones ?? []).reduce(
    (s, c) => s + Number(c.compensar),
    0,
  );

  // Anexo 18 · Dividendos → R49..R56
  const { data: divs } = await supabase
    .from("anexo_dividendos")
    .select(
      "no_constitutivos, distribuidos_no_residentes, gravados_tarifa_general, gravados_persona_natural_dos, gravados_personas_extranjeras, gravados_art_245, gravados_tarifa_l1819, gravados_proyectos",
    )
    .eq("declaracion_id", declId);
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

  // Anexo 26 · INCRNGO → R60
  const { data: incrngos } = await supabase
    .from("anexo_incrngo")
    .select("valor")
    .eq("declaracion_id", declId);
  const totalIncrngo = (incrngos ?? []).reduce((s, i) => s + Number(i.valor), 0);

  // Anexo 17 · Recuperación de deducciones → R70
  const { data: recups } = await supabase
    .from("anexo_recuperaciones")
    .select("valor")
    .eq("declaracion_id", declId);
  const totalRecuperaciones = (recups ?? []).reduce((s, r) => s + Number(r.valor), 0);

  // Anexo 1 · Renta Presuntiva → R76
  const { data: tarifaRpRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable)
    .eq("codigo", "tarifa_renta_presuntiva")
    .maybeSingle();
  const tarifaRP = tarifaRpRow ? Number(tarifaRpRow.valor) : 0;
  const plAnterior =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);
  const depuraciones =
    Number(declaracion.rp_acciones_sociedades_nacionales ?? 0) +
    Number(declaracion.rp_bienes_actividades_improductivas ?? 0) +
    Number(declaracion.rp_bienes_fuerza_mayor ?? 0) +
    Number(declaracion.rp_bienes_periodo_improductivo ?? 0) +
    Number(declaracion.rp_bienes_mineria ?? 0) +
    Number(declaracion.rp_primeros_19000_uvt_vivienda ?? 0);
  const baseRP = Math.max(0, plAnterior - depuraciones);
  const rentaPresuntiva =
    baseRP * tarifaRP + Number(declaracion.rp_renta_gravada_bienes_excluidos ?? 0);

  const cambiarModo = clearModoCargaAction.bind(null, declId, empresaId);

  return (
    <div>
      <Link
        href={`/empresas/${empresaId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← {declaracion.empresa?.razon_social}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            AG {declaracion.ano_gravable} · Formulario {declaracion.formato} ·{" "}
            {declaracion.estado}
            {declaracion.modo_carga ? (
              <>
                {" "}
                · modo{" "}
                <span className="text-foreground">
                  {declaracion.modo_carga === "manual" ? "manual" : "balance de prueba"}
                </span>
              </>
            ) : null}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Declaración de renta
          </h1>
        </div>
        {declaracion.modo_carga ? (
          <form action={cambiarModo}>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
            >
              Cambiar modo de carga
            </button>
          </form>
        ) : null}
      </div>

      {declaracion.modo_carga === null ? (
        <>
          <p className="mt-6 max-w-3xl text-muted-foreground">
            Cómo quieres cargar la información de esta declaración? Puedes cambiar la
            elección después si lo necesitas.
          </p>
          <ModePicker declId={declId} empresaId={empresaId} />
        </>
      ) : (
        <Workspace
          declId={declId}
          empresaId={empresaId}
          ano={declaracion.ano_gravable}
          modo={declaracion.modo_carga as "manual" | "balance"}
          tarifaRegimen={tarifaRegimen}
          regimenCodigo={regimenCodigo ?? null}
          impuestoNetoAnterior={Number(declaracion.impuesto_neto_anterior ?? 0)}
          aniosDeclarando={
            (declaracion.anios_declarando ?? "tercero_o_mas") as
              | "primero"
              | "segundo"
              | "tercero_o_mas"
          }
          presentacion={
            evaluacion.estado === "extemporanea"
              ? { estado: "extemporanea", mesesExtemporanea: evaluacion.mesesExtemporanea }
              : evaluacion.estado === "oportuna"
                ? { estado: "oportuna" }
                : { estado: "no_presentada" }
          }
          calculaSancionExtemporaneidad={!!declaracion.calcula_sancion_extemporaneidad}
          calculaSancionCorreccion={!!declaracion.calcula_sancion_correccion}
          mayorValorCorreccion={Number(declaracion.mayor_valor_correccion ?? 0)}
          existeEmplazamiento={!!declaracion.existe_emplazamiento}
          reduccionSancion={
            (declaracion.reduccion_sancion ?? "0") as "0" | "50" | "75"
          }
          uvtVigente={uvtVigente}
          patrimonioLiquidoAnterior={patrimonioLiquidoAnterior}
          esInstitucionFinanciera={!!declaracion.es_institucion_financiera}
          totalNomina={Number(declaracion.total_nomina ?? 0)}
          aportesSegSocial={Number(declaracion.aportes_seg_social ?? 0)}
          aportesParaFiscales={Number(declaracion.aportes_para_fiscales ?? 0)}
          beneficioAuditoria12m={!!declaracion.beneficio_auditoria_12m}
          beneficioAuditoria6m={!!declaracion.beneficio_auditoria_6m}
          totalAutorretenciones={totalAutorretenciones}
          totalRetenciones={totalRetenciones}
          totalDescuentosTributarios={totalDescuentosTributarios}
          goIngresos={goIngresos}
          goCostos={goCostos}
          goNoGravada={goNoGravada}
          totalRentasExentas={totalRentasExentas}
          totalCompensaciones={totalCompensaciones}
          totalRecuperaciones={totalRecuperaciones}
          rentaPresuntiva={rentaPresuntiva}
          dividendos={dividendos}
          totalIncrngo={totalIncrngo}
        />
      )}
    </div>
  );
}

async function Workspace({
  declId,
  empresaId,
  ano,
  modo,
  tarifaRegimen,
  regimenCodigo,
  impuestoNetoAnterior,
  aniosDeclarando,
  presentacion,
  calculaSancionExtemporaneidad,
  calculaSancionCorreccion,
  mayorValorCorreccion,
  existeEmplazamiento,
  reduccionSancion,
  uvtVigente,
  patrimonioLiquidoAnterior,
  esInstitucionFinanciera,
  totalNomina,
  aportesSegSocial,
  aportesParaFiscales,
  beneficioAuditoria12m,
  beneficioAuditoria6m,
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
  dividendos,
  totalIncrngo,
}: {
  declId: string;
  empresaId: string;
  ano: number;
  modo: "manual" | "balance";
  tarifaRegimen: number | null;
  regimenCodigo: string | null;
  impuestoNetoAnterior: number;
  aniosDeclarando: "primero" | "segundo" | "tercero_o_mas";
  presentacion: { estado: "no_presentada" | "oportuna" | "extemporanea"; mesesExtemporanea?: number };
  calculaSancionExtemporaneidad: boolean;
  calculaSancionCorreccion: boolean;
  mayorValorCorreccion: number;
  existeEmplazamiento: boolean;
  reduccionSancion: "0" | "50" | "75";
  uvtVigente: number | null;
  patrimonioLiquidoAnterior: number;
  esInstitucionFinanciera: boolean;
  totalNomina: number;
  aportesSegSocial: number;
  aportesParaFiscales: number;
  beneficioAuditoria12m: boolean;
  beneficioAuditoria6m: boolean;
  totalAutorretenciones: number;
  totalRetenciones: number;
  totalDescuentosTributarios: number;
  goIngresos: number;
  goCostos: number;
  goNoGravada: number;
  totalRentasExentas: number;
  totalCompensaciones: number;
  totalRecuperaciones: number;
  rentaPresuntiva: number;
  dividendos: {
    r49: number; r50: number; r51: number; r52: number;
    r53: number; r54: number; r55: number; r56: number;
  };
  totalIncrngo: number;
}) {
  const supabase = await createClient();

  // Datos comunes
  const [{ data: renglones }, { data: valores }] = await Promise.all([
    supabase
      .from("form110_renglones")
      .select("numero, descripcion, seccion")
      .eq("ano_gravable", ano)
      .order("numero"),
    supabase
      .from("form110_valores")
      .select("numero, valor")
      .eq("declaracion_id", declId),
  ]);

  // Si modo es balance, traemos la info del balance
  let balanceCard: React.ReactNode = null;
  if (modo === "balance") {
    const { data: balance } = await supabase
      .from("balance_pruebas")
      .select("id, filename, uploaded_at")
      .eq("declaracion_id", declId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!balance) {
      balanceCard = (
        <div className="mt-12 max-w-2xl border border-dashed border-border p-8">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Modo balance · sin archivo cargado
          </p>
          <h3 className="mt-3 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
            Sube tu Balance de Prueba
          </h3>
          <p className="mt-3 text-muted-foreground">
            Cuando subas el archivo, Tribai mapea cada cuenta PUC al renglón
            correspondiente del 110 y rellena los valores automáticamente.
          </p>
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/importar`}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
          >
            Cargar archivo →
          </Link>
        </div>
      );
    } else {
      const [
        { count: totalLineas },
        { count: mapeadas },
        { count: pendientes },
      ] = await Promise.all([
        supabase
          .from("balance_prueba_lineas")
          .select("*", { count: "exact", head: true })
          .eq("balance_id", balance.id),
        supabase
          .from("balance_prueba_lineas")
          .select("*", { count: "exact", head: true })
          .eq("balance_id", balance.id)
          .not("renglon_110", "is", null),
        supabase
          .from("balance_prueba_lineas")
          .select("*", { count: "exact", head: true })
          .eq("balance_id", balance.id)
          .is("renglon_110", null)
          .like("cuenta", "______%"), // solo auxiliares (6+ chars)
      ]);

      balanceCard = (
        <div className="mt-12 border border-border p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Balance cargado · {new Date(balance.uploaded_at).toLocaleString("es-CO")}
              </p>
              <h3 className="mt-2 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
                {balance.filename}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/empresas/${empresaId}/declaraciones/${declId}/balance`}
                className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-xs text-primary-foreground hover:opacity-90"
              >
                Ver balance completo →
              </Link>
              <Link
                href={`/empresas/${empresaId}/declaraciones/${declId}/importar`}
                className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
              >
                Reemplazar archivo
              </Link>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Líneas" value={totalLineas ?? 0} />
            <Stat label="Mapeadas" value={mapeadas ?? 0} success={(mapeadas ?? 0) > 0} />
            <Stat
              label="Pendientes"
              value={pendientes ?? 0}
              alert={(pendientes ?? 0) > 0}
              muted={(pendientes ?? 0) === 0}
              href={
                (pendientes ?? 0) > 0
                  ? `/empresas/${empresaId}/declaraciones/${declId}/balance?filter=pendientes`
                  : undefined
              }
            />
          </div>
        </div>
      );
    }
  }

  return (
    <>
      {balanceCard}

      <div className="mt-12">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          {modo === "balance" ? "Renglones del 110 (ajustes manuales)" : "Renglones del 110"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {modo === "balance"
            ? "Los valores vienen del balance importado. Puedes ajustar cualquier renglón manualmente; tu cambio sobreescribe el valor agregado."
            : "Digita los valores en cada renglón. Los miles se formatean automáticamente."}
        </p>
        {tarifaRegimen != null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Régimen <span className="font-mono">{regimenCodigo}</span> · tarifa{" "}
            <span className="font-mono">{(tarifaRegimen * 100).toFixed(2)}%</span>{" "}
            (se aplica al renglón 84 sobre la renta líquida gravable)
          </p>
        ) : (
          <p className="mt-2 text-xs text-destructive">
            Esta empresa no tiene régimen tributario configurado. Edita la empresa para que el
            renglón 84 (impuesto) se calcule automáticamente.
          </p>
        )}
        <div className="mt-6">
          <DeclaracionEditor
            declId={declId}
            empresaId={empresaId}
            renglones={renglones ?? []}
            valoresIniciales={(valores ?? []).map((v) => ({
              numero: v.numero,
              valor: Number(v.valor),
            }))}
            tarifaRegimen={tarifaRegimen}
            impuestoNetoAnterior={impuestoNetoAnterior}
            aniosDeclarando={aniosDeclarando}
            presentacion={presentacion}
            calculaSancionExtemporaneidad={calculaSancionExtemporaneidad}
            calculaSancionCorreccion={calculaSancionCorreccion}
            mayorValorCorreccion={mayorValorCorreccion}
            existeEmplazamiento={existeEmplazamiento}
            reduccionSancion={reduccionSancion}
            uvtVigente={uvtVigente}
            patrimonioLiquidoAnterior={patrimonioLiquidoAnterior}
            esInstitucionFinanciera={esInstitucionFinanciera}
            totalNomina={totalNomina}
            aportesSegSocial={aportesSegSocial}
            aportesParaFiscales={aportesParaFiscales}
            beneficioAuditoria12m={beneficioAuditoria12m}
            beneficioAuditoria6m={beneficioAuditoria6m}
            totalAutorretenciones={totalAutorretenciones}
            totalRetenciones={totalRetenciones}
            totalDescuentosTributarios={totalDescuentosTributarios}
            goIngresos={goIngresos}
            goCostos={goCostos}
            goNoGravada={goNoGravada}
            totalRentasExentas={totalRentasExentas}
            totalCompensaciones={totalCompensaciones}
            totalRecuperaciones={totalRecuperaciones}
            rentaPresuntiva={rentaPresuntiva}
            dividendos={dividendos}
            totalIncrngo={totalIncrngo}
          />
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  success,
  alert,
  muted,
  href,
}: {
  label: string;
  value: number;
  success?: boolean;
  alert?: boolean;
  muted?: boolean;
  href?: string;
}) {
  const cls = alert
    ? "border-destructive/40 bg-destructive/5"
    : success
      ? "border-success/40 bg-success/5"
      : "border-border";
  const valueCls = alert ? "text-destructive" : muted ? "text-muted-foreground" : "";

  const content = (
    <div className={`border p-4 ${cls}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-2xl tracking-[-0.02em] ${valueCls}`}>
        {FMT.format(value)}
      </p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
