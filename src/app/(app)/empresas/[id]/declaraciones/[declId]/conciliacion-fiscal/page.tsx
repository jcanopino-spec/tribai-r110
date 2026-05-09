import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PartidaForm } from "./partida-form";
import { PartidasList } from "./list";

export const metadata = { title: "Conciliación Fiscal" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function ConciliacionPage({
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

  // Cargar balance fiscal de esta declaración
  const { data: balanceMeta } = await supabase
    .from("balance_pruebas")
    .select("id")
    .eq("declaracion_id", declId)
    .maybeSingle();

  // Cargar partidas manuales + anexos + balance en paralelo
  const [
    partidasRes,
    icaRes,
    gmfRes,
    intPresRes,
    difCambioRes,
    trmRes,
    tasaIntRes,
    r72Res,
    balanceLineasRes,
    incrngoRes,
    recupRes,
    donacionesRes,
  ] = await Promise.all([
    supabase
      .from("conciliacion_partidas")
      .select("id, tipo, signo, concepto, valor, observacion")
      .eq("declaracion_id", declId)
      .order("created_at"),
    supabase.from("anexo_ica").select("valor_pagado").eq("declaracion_id", declId),
    supabase.from("anexo_gmf").select("valor_gmf").eq("declaracion_id", declId),
    supabase
      .from("anexo_intereses_presuntivos")
      .select("saldo_promedio, dias, interes_registrado")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_diferencia_cambio")
      .select("tipo, valor_usd, trm_inicial")
      .eq("declaracion_id", declId),
    supabase
      .from("parametros_anuales")
      .select("valor")
      .eq("ano_gravable", declaracion.ano_gravable)
      .eq("codigo", "trm_promedio")
      .maybeSingle(),
    supabase
      .from("parametros_anuales")
      .select("valor")
      .eq("ano_gravable", declaracion.ano_gravable)
      .eq("codigo", "tasa_interes_presuntivo")
      .maybeSingle(),
    supabase
      .from("form110_valores")
      .select("valor")
      .eq("declaracion_id", declId)
      .eq("numero", 72)
      .maybeSingle(),
    balanceMeta
      ? supabase
          .from("balance_prueba_lineas")
          .select("cuenta, nombre, ajuste_debito, ajuste_credito")
          .eq("balance_id", balanceMeta.id)
          .or("ajuste_debito.gt.0,ajuste_credito.gt.0")
      : Promise.resolve({ data: [] }),
    supabase.from("anexo_incrngo").select("valor").eq("declaracion_id", declId),
    supabase.from("anexo_recuperaciones").select("valor").eq("declaracion_id", declId),
    supabase
      .from("anexo_descuentos")
      .select("categoria, valor_descuento")
      .eq("declaracion_id", declId),
  ]);

  const partidasManuales = (partidasRes.data ?? []).map((p) => ({
    id: p.id,
    tipo: p.tipo as "permanente" | "temporal",
    signo: p.signo as "mas" | "menos",
    concepto: p.concepto,
    valor: Number(p.valor),
    observacion: p.observacion,
    origen: "manual" as const,
  }));

  const r72 = r72Res.data ? Number(r72Res.data.valor) : 0;
  const trmFinal = trmRes.data ? Number(trmRes.data.valor) : 0;
  const tasaIntPres = tasaIntRes.data ? Number(tasaIntRes.data.valor) : 0;

  // Utilidad contable proviene de /configuracion (cuentas 3605/3610)
  const utilidadCont = Number(declaracion.utilidad_contable ?? 0);
  const perdidaCont = Number(declaracion.perdida_contable ?? 0);
  const utilidadContable = utilidadCont - perdidaCont;

  // ─── Partidas derivadas automáticamente ─────────────────────────────────
  type Auto = {
    id: string;
    tipo: "permanente" | "temporal";
    signo: "mas" | "menos";
    concepto: string;
    valor: number;
    observacion: string | null;
    origen: "auto";
    fuente: string;
  };
  const partidasAuto: Auto[] = [];

  // ICA: 50% pagado se asume tomado como descuento → no deducible
  const totalIca = (icaRes.data ?? []).reduce((s, r) => s + Number(r.valor_pagado), 0);
  if (totalIca > 0 && declaracion.ica_como_descuento) {
    partidasAuto.push({
      id: "auto-ica-50",
      tipo: "permanente",
      signo: "mas",
      concepto: "50% ICA pagado (tomado como descuento tributario)",
      valor: totalIca * 0.5,
      observacion: "Art. 115 E.T.: solo el 50% es deducible cuando se toma como descuento.",
      origen: "auto",
      fuente: "ICA pagado",
    });
  }

  // INCRNGO · ingresos no constitutivos de renta ni GO (R141 xlsm)
  // Son ingresos contables que NO son fiscales → restan a la utilidad fiscal.
  const totalIncrngo = (incrngoRes.data ?? []).reduce(
    (s, r) => s + Number(r.valor),
    0,
  );
  if (totalIncrngo > 0) {
    partidasAuto.push({
      id: "auto-incrngo",
      tipo: "permanente",
      signo: "menos",
      concepto: "Ingresos no constitutivos de renta ni ganancia ocasional",
      valor: totalIncrngo,
      observacion:
        "Ingresos contables que la ley excluye de la base gravable (Arts. 36 a 57-2 E.T.). Se restan de la utilidad para llegar a la renta fiscal.",
      origen: "auto",
      fuente: "INCRNGO",
    });
  }

  // Recuperación de deducciones (R149/R188 xlsm) · Art. 195 E.T.
  // Renta fiscal adicional que no aparece en la utilidad contable estándar.
  const totalRecup = (recupRes.data ?? []).reduce((s, r) => s + Number(r.valor), 0);
  if (totalRecup > 0) {
    partidasAuto.push({
      id: "auto-recuperacion",
      tipo: "permanente",
      signo: "mas",
      concepto: "Renta líquida por recuperación de deducciones",
      valor: totalRecup,
      observacion:
        "Reversiones de partidas que disminuyeron rentas líquidas anteriores (Art. 195 E.T.). Suman a la renta fiscal aunque ya estén en utilidad contable.",
      origen: "auto",
      fuente: "Recuperación deducciones",
    });
  }

  // Donaciones tomadas como descuento tributario (Art. 257 E.T.)
  // Si están en Anexo 4 con categoría "donacion", el valor donado en sí
  // se considera no deducible como gasto (porque ya está en R93).
  const donacionesDescuento = (donacionesRes.data ?? [])
    .filter((d) => String(d.categoria).toLowerCase().includes("donaci"))
    .reduce((s, d) => s + Number(d.valor_descuento), 0);
  if (donacionesDescuento > 0) {
    partidasAuto.push({
      id: "auto-donaciones",
      tipo: "permanente",
      signo: "mas",
      concepto: "Donaciones tomadas como descuento (no deducibles como gasto)",
      valor: donacionesDescuento * 4, // descuento ~25% → gasto base ~4x
      observacion:
        "Las donaciones tomadas como descuento del 25% (Art. 257 E.T.) NO son deducibles como gasto. La utilidad contable las trataba como gasto.",
      origen: "auto",
      fuente: "Descuentos tributarios",
    });
  }

  // Sanciones causadas en el año · multas, intereses moratorios DIAN (R173 xlsm)
  // No son deducibles (Art. 105 E.T.).
  // Si se calcula sanción extemporaneidad o corrección, el valor estimado
  // puede provisionarse contablemente y debe sumarse fiscalmente como no
  // deducible.
  // Por ahora dejamos esto MANUAL — el usuario sabe si tiene sanciones DIAN
  // adicionales en su PyG. La sanción del 110 misma se descuenta del saldo,
  // no entra a la conciliación de utilidad.

  // GMF: 50% no deducible (Art. 115 E.T.)
  const totalGmf = (gmfRes.data ?? []).reduce((s, r) => s + Number(r.valor_gmf), 0);
  if (totalGmf > 0) {
    partidasAuto.push({
      id: "auto-gmf-50",
      tipo: "permanente",
      signo: "mas",
      concepto: "50% GMF no deducible",
      valor: totalGmf * 0.5,
      observacion: null,
      origen: "auto",
      fuente: "GMF",
    });
  }

  // Deterioro de cartera: provisión fiscal vs contable
  const dcMetodo = (declaracion.dc_metodo ?? "general") as
    | "general"
    | "individual"
    | "combinado";
  const dc0_90 = Number(declaracion.dc_cartera_0_90 ?? 0);
  const dc91 = Number(declaracion.dc_cartera_91_180 ?? 0);
  const dc181 = Number(declaracion.dc_cartera_181_360 ?? 0);
  const dc360 = Number(declaracion.dc_cartera_360_mas ?? 0);
  const dcSaldoCont = Number(declaracion.dc_saldo_contable ?? 0);
  const provGen = dc0_90 * 0 + dc91 * 0.05 + dc181 * 0.10 + dc360 * 0.15;
  const provInd = dc360 * 0.33;
  const provCombo = Math.max(provGen, provInd);
  const provFiscal =
    dcMetodo === "general" ? provGen : dcMetodo === "individual" ? provInd : provCombo;
  const ajusteDc = provFiscal - dcSaldoCont;
  if (Math.abs(ajusteDc) > 0.01) {
    partidasAuto.push({
      id: "auto-deterioro",
      tipo: "temporal",
      signo: ajusteDc > 0 ? "menos" : "mas",
      concepto:
        ajusteDc > 0
          ? "Mayor provisión fiscal cartera vs. contable"
          : "Menor provisión fiscal cartera vs. contable (reverso)",
      valor: Math.abs(ajusteDc),
      observacion: `Método: ${dcMetodo}. Provisión fiscal ${FMT.format(provFiscal)} vs. saldo contable ${FMT.format(dcSaldoCont)}.`,
      origen: "auto",
      fuente: "Deterioro de Cartera",
    });
  }

  // Interés presuntivo (Art. 35 E.T.)
  const totalIntPresunto = (intPresRes.data ?? []).reduce((s, p) => {
    const presunto =
      Number(p.saldo_promedio) * tasaIntPres * (Number(p.dias) / 360);
    return s + Math.max(0, presunto - Number(p.interes_registrado));
  }, 0);
  if (totalIntPresunto > 0) {
    partidasAuto.push({
      id: "auto-int-presuntivo",
      tipo: "permanente",
      signo: "mas",
      concepto: "Interés presuntivo a socios (Art. 35 E.T.)",
      valor: totalIntPresunto,
      observacion: null,
      origen: "auto",
      fuente: "Interés Presuntivo",
    });
  }

  // Subcapitalización (intereses no deducibles)
  if (declaracion.sub_es_vinculado) {
    const deuda = Number(declaracion.sub_deuda_promedio ?? 0);
    const intereses = Number(declaracion.sub_intereses ?? 0);
    const patrimonioLiqAnterior =
      Number(declaracion.patrimonio_bruto_anterior ?? 0) -
      Number(declaracion.pasivos_anterior ?? 0);
    const limite = patrimonioLiqAnterior * 2;
    const exceso = Math.max(0, deuda - limite);
    const propExc = deuda > 0 ? exceso / deuda : 0;
    const intNoDed = intereses * propExc;
    if (intNoDed > 0.01) {
      partidasAuto.push({
        id: "auto-subcap",
        tipo: "permanente",
        signo: "mas",
        concepto: "Intereses no deducibles por subcapitalización (Art. 118-1 E.T.)",
        valor: intNoDed,
        observacion: `Exceso: ${FMT.format(exceso)} / deuda ${FMT.format(deuda)} (${(propExc * 100).toFixed(2)}%).`,
        origen: "auto",
        fuente: "Subcapitalización",
      });
    }
  }

  // Diferencia en cambio neta (no realizada → temporal)
  const totalDifCambio = (difCambioRes.data ?? []).reduce((s, d) => {
    const valIni = Number(d.valor_usd) * Number(d.trm_inicial);
    const valFin = Number(d.valor_usd) * trmFinal;
    const dif = valFin - valIni;
    return s + (d.tipo === "pasivo" ? -dif : dif);
  }, 0);
  if (Math.abs(totalDifCambio) > 0.01) {
    partidasAuto.push({
      id: "auto-dif-cambio",
      tipo: "temporal",
      signo: totalDifCambio > 0 ? "mas" : "menos",
      concepto:
        totalDifCambio > 0
          ? "Diferencia en cambio · ingreso fiscal"
          : "Diferencia en cambio · gasto fiscal",
      valor: Math.abs(totalDifCambio),
      observacion: "Causación fiscal por TRM final del año.",
      origen: "auto",
      fuente: "Diferencia en Cambio",
    });
  }

  // Balance Fiscal · ajustes en cuentas P&L (4xxx ingresos, 5/6/7xxx costos/gastos)
  // Convención del sistema: ajuste_credito en costo/gasto reduce el costo fiscal
  // (suma a la utilidad fiscal); ajuste_debito en costo lo aumenta (resta).
  // Ingresos al revés: credito aumenta ingreso fiscal (suma); debito lo reduce (resta).
  for (const l of balanceLineasRes.data ?? []) {
    const cuenta = String(l.cuenta);
    const primer = cuenta.charAt(0);
    if (!["4", "5", "6", "7"].includes(primer)) continue;
    const ajDeb = Number(l.ajuste_debito ?? 0);
    const ajCre = Number(l.ajuste_credito ?? 0);
    if (ajDeb === 0 && ajCre === 0) continue;
    const esIngreso = primer === "4";
    // Efecto en utilidad fiscal:
    //   Ingreso (4): +credito −debito
    //   Costo/gasto (5/6/7): +credito −debito (porque crédito reduce costo)
    const efecto = ajCre - ajDeb;
    if (Math.abs(efecto) < 0.01) continue;
    partidasAuto.push({
      id: `auto-bal-${l.cuenta}`,
      tipo: "permanente",
      signo: efecto > 0 ? "mas" : "menos",
      concepto: `Ajuste fiscal · ${l.cuenta} ${l.nombre ?? ""}`.trim(),
      valor: Math.abs(efecto),
      observacion: esIngreso
        ? `Ajuste sobre ingreso (cuenta ${primer}xxx).`
        : `Ajuste sobre costo/gasto (cuenta ${primer}xxx).`,
      origen: "auto",
      fuente: "Balance Fiscal",
    });
  }

  const todas = [...partidasAuto, ...partidasManuales];

  const sumaMasPerm = todas
    .filter((p) => p.tipo === "permanente" && p.signo === "mas")
    .reduce((s, p) => s + p.valor, 0);
  const sumaMenosPerm = todas
    .filter((p) => p.tipo === "permanente" && p.signo === "menos")
    .reduce((s, p) => s + p.valor, 0);
  const sumaMasTemp = todas
    .filter((p) => p.tipo === "temporal" && p.signo === "mas")
    .reduce((s, p) => s + p.valor, 0);
  const sumaMenosTemp = todas
    .filter((p) => p.tipo === "temporal" && p.signo === "menos")
    .reduce((s, p) => s + p.valor, 0);

  const netoPerm = sumaMasPerm - sumaMenosPerm;
  const netoTemp = sumaMasTemp - sumaMenosTemp;
  const rentaCalculada = utilidadContable + netoPerm + netoTemp;
  const diff = r72 - rentaCalculada;
  const cuadra = Math.abs(diff) < 1;

  // Estimado de impuesto diferido (sólo informativo, tarifa 35%)
  const tarifa = 0.35;
  const impuestoDiferidoNeto = netoTemp * tarifa;

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver a Conciliaciones
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Conciliación de Utilidad
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Explica las diferencias entre la utilidad contable antes de impuestos
        y la renta líquida fiscal por concepto. Las diferencias permanentes no
        se revierten; las temporales generan impuesto diferido.
      </p>
      {partidasAuto.length > 0 ? (
        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
          Las partidas marcadas{" "}
          <span className="font-mono uppercase">auto</span> se derivan
          automáticamente de los anexos y del Balance Fiscal. Para modificarlas,
          vuelve al anexo o al balance.
        </p>
      ) : null}

      {/* Punto de partida */}
      <section className="mt-10">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          Punto de partida
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Utilidad (o pérdida) contable antes del impuesto sobre la renta.
          Se toma de Configuración (cuentas 3605/3610).
        </p>
        <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-3">
          <Stat label="Utilidad contable" value={utilidadCont} />
          <Stat label="Pérdida contable" value={perdidaCont} />
          <Stat label="Neto" value={utilidadContable} emphasis />
        </div>
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}/configuracion`}
          className="mt-3 inline-block font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
        >
          Editar en Configuración →
        </Link>
      </section>

      {/* Resumen visual de la conciliación */}
      <section className="mt-12">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          Conciliación en cascada
        </h2>
        <div className="mt-5 border border-border">
          <Row label="Utilidad contable antes de impuestos" value={utilidadContable} />
          <Row label="(+) Permanentes que suman" value={sumaMasPerm} muted />
          <Row label="(−) Permanentes que restan" value={-sumaMenosPerm} muted />
          <Row label="(+) Temporales que suman" value={sumaMasTemp} muted />
          <Row label="(−) Temporales que restan" value={-sumaMenosTemp} muted />
          <Row
            label="Renta líquida fiscal calculada"
            value={rentaCalculada}
            emphasis
          />
        </div>
      </section>

      {/* Cruce con formulario */}
      <section className="mt-10">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          Cruce con el formulario
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat label="Calculada" value={rentaCalculada} />
          <Stat label="R72 actual del 110" value={r72} />
          <Stat label="Diferencia" value={diff} alert={!cuadra} emphasis />
        </div>
        <p
          className={`mt-3 text-xs ${
            cuadra ? "text-success" : "text-destructive"
          }`}
        >
          {cuadra
            ? "✓ La conciliación cuadra con la renta líquida del formulario."
            : `⚠ Diferencia de ${FMT.format(diff)}. Revisa partidas faltantes o el Balance Fiscal.`}
        </p>
      </section>

      {/* Impuesto diferido informativo */}
      <section className="mt-10 border border-dashed border-border p-5">
        <h3 className="font-serif text-xl">Impacto en impuesto diferido</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Estimación informativa con tarifa nominal {(tarifa * 100).toFixed(0)}%.
          Las diferencias temporales generan activos o pasivos por impuesto
          diferido (NIC 12 / Sección 29 NIIF).
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Stat label="Diferencias temporales netas" value={netoTemp} />
          <Stat
            label={
              impuestoDiferidoNeto >= 0
                ? "Activo por impuesto diferido (estimado)"
                : "Pasivo por impuesto diferido (estimado)"
            }
            value={Math.abs(impuestoDiferidoNeto)}
          />
        </div>
      </section>

      {/* Form de partidas */}
      <div className="mt-12">
        <PartidaForm declId={declId} empresaId={empresaId} />
      </div>

      {/* Listado */}
      <div className="mt-12">
        <PartidasList items={todas} declId={declId} empresaId={empresaId} />
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
        emphasis ? "bg-muted/40" : ""
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
        className={`font-mono ${
          emphasis ? "font-serif text-xl tracking-[-0.02em]" : "text-sm"
        }`}
      >
        {value < 0 ? "−" : ""}
        {FMT.format(Math.abs(value))}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
  emphasis,
}: {
  label: string;
  value: number;
  alert?: boolean;
  emphasis?: boolean;
}) {
  const cls = emphasis
    ? "border-foreground bg-foreground text-background"
    : "border-border";
  return (
    <div className={`border p-5 ${cls}`}>
      <p
        className={`font-mono text-xs uppercase tracking-[0.05em] ${
          emphasis ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 font-serif text-2xl tracking-[-0.02em] ${
          alert && !emphasis ? "text-destructive" : ""
        }`}
      >
        {value < 0 ? "−" : ""}
        {FMT.format(Math.abs(value))}
      </p>
    </div>
  );
}
