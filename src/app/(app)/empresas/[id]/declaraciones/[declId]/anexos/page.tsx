import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Anexos" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

type AnexoCard = {
  numero: string;
  titulo: string;
  href: string;
  renglones: number[];
  total: number;
  items: number;
  descripcion: string;
};

export default async function AnexosHubPage({
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

  // Cargar totales de cada anexo en paralelo
  const { data: tasaRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable)
    .eq("codigo", "tasa_interes_presuntivo")
    .maybeSingle();
  const tasaInteresPresuntivo = tasaRow ? Number(tasaRow.valor) : 0;

  const { data: trmRow } = await supabase
    .from("parametros_anuales")
    .select("valor")
    .eq("ano_gravable", declaracion.ano_gravable)
    .eq("codigo", "trm_promedio")
    .maybeSingle();
  const trmFinal = trmRow ? Number(trmRow.valor) : 0;

  const [
    retenciones,
    descuentos,
    go,
    rentasExentas,
    compensaciones,
    recuperaciones,
    dividendos,
    incrngo,
    intereses,
    difCambio,
    ica,
    gmf,
    predial,
    ivaCapital,
    segSocial,
    divDist,
  ] = await Promise.all([
    supabase
      .from("anexo_retenciones")
      .select("retenido, tipo")
      .eq("declaracion_id", declId),
    supabase.from("anexo_descuentos").select("valor_descuento").eq("declaracion_id", declId),
    supabase
      .from("anexo_ganancia_ocasional")
      .select("precio_venta, costo_fiscal, no_gravada")
      .eq("declaracion_id", declId),
    supabase.from("anexo_rentas_exentas").select("valor_fiscal").eq("declaracion_id", declId),
    supabase.from("anexo_compensaciones").select("compensar").eq("declaracion_id", declId),
    supabase.from("anexo_recuperaciones").select("valor").eq("declaracion_id", declId),
    supabase.from("anexo_dividendos").select("*").eq("declaracion_id", declId),
    supabase.from("anexo_incrngo").select("valor").eq("declaracion_id", declId),
    supabase
      .from("anexo_intereses_presuntivos")
      .select("saldo_promedio, dias, interes_registrado")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_diferencia_cambio")
      .select("tipo, valor_usd, trm_inicial")
      .eq("declaracion_id", declId),
    supabase.from("anexo_ica").select("valor_pagado").eq("declaracion_id", declId),
    supabase.from("anexo_gmf").select("valor_gmf").eq("declaracion_id", declId),
    supabase.from("anexo_predial").select("valor_pagado").eq("declaracion_id", declId),
    supabase.from("anexo_iva_capital").select("iva_pagado").eq("declaracion_id", declId),
    supabase
      .from("anexo_seg_social")
      .select("aporte_salud, aporte_pension, aporte_arl, aporte_parafiscales")
      .eq("declaracion_id", declId),
    supabase
      .from("anexo_dividendos_distribuir")
      .select("dividendo_no_gravado, dividendo_gravado")
      .eq("declaracion_id", declId),
  ]);

  const totalRet =
    (retenciones.data ?? []).reduce((s, r) => s + Number(r.retenido), 0);
  const totalDesc =
    (descuentos.data ?? []).reduce((s, d) => s + Number(d.valor_descuento), 0);
  const goItems = go.data ?? [];
  const totalGoBruto = goItems.reduce((s, g) => s + Number(g.precio_venta), 0);
  const totalRE =
    (rentasExentas.data ?? []).reduce((s, r) => s + Number(r.valor_fiscal), 0);
  const totalComp =
    (compensaciones.data ?? []).reduce((s, c) => s + Number(c.compensar), 0);
  const totalRec =
    (recuperaciones.data ?? []).reduce((s, r) => s + Number(r.valor), 0);
  const totalDiv = (dividendos.data ?? []).reduce(
    (s, d) =>
      s +
      Number(d.no_constitutivos) +
      Number(d.distribuidos_no_residentes) +
      Number(d.gravados_tarifa_general) +
      Number(d.gravados_persona_natural_dos) +
      Number(d.gravados_personas_extranjeras) +
      Number(d.gravados_art_245) +
      Number(d.gravados_tarifa_l1819) +
      Number(d.gravados_proyectos),
    0,
  );
  const totalIncr =
    (incrngo.data ?? []).reduce((s, i) => s + Number(i.valor), 0);
  const totalDifInteres = (intereses.data ?? []).reduce((s, p) => {
    const presunto =
      Number(p.saldo_promedio) * tasaInteresPresuntivo * (Number(p.dias) / 360);
    return s + Math.max(0, presunto - Number(p.interes_registrado));
  }, 0);

  const totalDifCambio = (difCambio.data ?? []).reduce((s, d) => {
    const valorIni = Number(d.valor_usd) * Number(d.trm_inicial);
    const valorFin = Number(d.valor_usd) * trmFinal;
    const dif = valorFin - valorIni;
    return s + (d.tipo === "pasivo" ? -dif : dif);
  }, 0);

  const totalIca = (ica.data ?? []).reduce((s, i) => s + Number(i.valor_pagado), 0);
  const totalGmf = (gmf.data ?? []).reduce((s, i) => s + Number(i.valor_gmf), 0);
  const totalPredial = (predial.data ?? []).reduce((s, i) => s + Number(i.valor_pagado), 0);
  const totalIvaCap = (ivaCapital.data ?? []).reduce((s, i) => s + Number(i.iva_pagado), 0);
  const totalSegSocial = (segSocial.data ?? []).reduce(
    (s, i) =>
      s +
      Number(i.aporte_salud) +
      Number(i.aporte_pension) +
      Number(i.aporte_arl) +
      Number(i.aporte_parafiscales),
    0,
  );
  const totalDivDist = (divDist.data ?? []).reduce(
    (s, i) => s + Number(i.dividendo_no_gravado) + Number(i.dividendo_gravado),
    0,
  );
  const subActivo = Boolean(declaracion.sub_es_vinculado);
  const subIntereses = Number(declaracion.sub_intereses ?? 0);

  const cards: AnexoCard[] = [
    {
      numero: "1",
      titulo: "Renta Presuntiva",
      href: "renta-presuntiva",
      renglones: [76],
      total: 0, // calculada en el editor; mostraremos 0 aquí
      items: 0,
      descripcion: "Patrimonio líquido AG anterior × tarifa (0% en AG 2025).",
    },
    {
      numero: "3",
      titulo: "Retenciones y Autorretenciones",
      href: "retenciones",
      renglones: [105, 106],
      total: totalRet,
      items: retenciones.data?.length ?? 0,
      descripcion: "Lista de retenciones y autorretenciones del año.",
    },
    {
      numero: "4",
      titulo: "Descuentos Tributarios",
      href: "descuentos",
      renglones: [93],
      total: totalDesc,
      items: descuentos.data?.length ?? 0,
      descripcion: "Impuestos exterior, donaciones, ICA 50%, otros.",
    },
    {
      numero: "8",
      titulo: "Ganancias Ocasionales",
      href: "ganancia-ocasional",
      renglones: [80, 81, 82],
      total: totalGoBruto,
      items: goItems.length,
      descripcion: "Activos fijos, rifas, herencias, liquidaciones, etc.",
    },
    {
      numero: "17",
      titulo: "Recuperación de Deducciones",
      href: "recuperaciones",
      renglones: [70],
      total: totalRec,
      items: recuperaciones.data?.length ?? 0,
      descripcion: "Reversiones de partidas que disminuyeron rentas anteriores.",
    },
    {
      numero: "18",
      titulo: "Ingresos por Dividendos",
      href: "dividendos",
      renglones: [49, 50, 51, 52, 53, 54, 55, 56],
      total: totalDiv,
      items: dividendos.data?.length ?? 0,
      descripcion: "Dividendos por categoría tributaria y tercero.",
    },
    {
      numero: "19",
      titulo: "Rentas Exentas",
      href: "rentas-exentas",
      renglones: [77],
      total: totalRE,
      items: rentasExentas.data?.length ?? 0,
      descripcion: "Art. 235-2 ET y otras categorías exentas.",
    },
    {
      numero: "20",
      titulo: "Compensación de Pérdidas",
      href: "compensaciones",
      renglones: [74],
      total: totalComp,
      items: compensaciones.data?.length ?? 0,
      descripcion: "Pérdidas (12 años) y excesos de RP (5 años).",
    },
    {
      numero: "26",
      titulo: "INCRNGO",
      href: "incrngo",
      renglones: [60],
      total: totalIncr,
      items: incrngo.data?.length ?? 0,
      descripcion: "Ingresos no constitutivos de renta ni ganancia ocasional.",
    },
    {
      numero: "14",
      titulo: "Interés Presuntivo",
      href: "intereses-presuntivos",
      renglones: [48],
      total: totalDifInteres,
      items: intereses.data?.length ?? 0,
      descripcion:
        "Préstamos a socios (Art. 35 E.T.). Diferencia entre interés presunto e interés registrado.",
    },
    {
      numero: "22",
      titulo: "Diferencia en Cambio",
      href: "diferencia-cambio",
      renglones: [48, 65],
      total: totalDifCambio,
      items: difCambio.data?.length ?? 0,
      descripcion:
        "Cuentas en USD. Diferencia entre TRM inicial y final del año (no realizada).",
    },
    {
      numero: "12",
      titulo: "Deterioro de Cartera",
      href: "deterioro-cartera",
      renglones: [],
      total: 0,
      items:
        Number(declaracion.dc_cartera_0_90 ?? 0) +
          Number(declaracion.dc_cartera_91_180 ?? 0) +
          Number(declaracion.dc_cartera_181_360 ?? 0) +
          Number(declaracion.dc_cartera_360_mas ?? 0) >
        0
          ? 1
          : 0,
      descripcion: "Provisión fiscal por antigüedad (Art. 145 E.T.). General/Individual/Combinado.",
    },
    {
      numero: "9",
      titulo: "ICA",
      href: "ica",
      renglones: [93],
      total: totalIca,
      items: ica.data?.length ?? 0,
      descripcion: "Pagos de Industria y Comercio por municipio. 50% como descuento (Anexo 4).",
    },
    {
      numero: "10",
      titulo: "GMF (4×1000)",
      href: "gmf",
      renglones: [],
      total: totalGmf,
      items: gmf.data?.length ?? 0,
      descripcion: "Gravamen a Movimientos Financieros. 50% deducible (Art. 115 E.T.).",
    },
    {
      numero: "11",
      titulo: "Predial",
      href: "predial",
      renglones: [],
      total: totalPredial,
      items: predial.data?.length ?? 0,
      descripcion: "Impuesto Predial Unificado. Deducible si hay relación de causalidad.",
    },
    {
      numero: "13",
      titulo: "IVA Bienes de Capital",
      href: "iva-capital",
      renglones: [93],
      total: totalIvaCap,
      items: ivaCapital.data?.length ?? 0,
      descripcion: "IVA pagado en bienes de capital. Descuento (Art. 258-1 E.T.).",
    },
    {
      numero: "15",
      titulo: "Subcapitalización",
      href: "subcapitalizacion",
      renglones: [],
      total: subActivo ? subIntereses : 0,
      items: subActivo ? 1 : 0,
      descripcion: "Limitación de intereses con vinculados (Art. 118-1 E.T.). 2× patrimonio líquido.",
    },
    {
      numero: "21",
      titulo: "Seguridad Social",
      href: "seguridad-social",
      renglones: [],
      total: totalSegSocial,
      items: segSocial.data?.length ?? 0,
      descripcion: "Aportes salud, pensión, ARL y parafiscales. Requisito Art. 108 E.T.",
    },
    {
      numero: "25",
      titulo: "Dividendos a Distribuir",
      href: "dividendos-distribuir",
      renglones: [],
      total: totalDivDist,
      items: divDist.data?.length ?? 0,
      descripcion: "Distribución a socios: gravado vs. no gravado (Art. 49 E.T.).",
    },
  ];

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Anexos
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Cada anexo alimenta uno o varios renglones del Formulario 110. Los totales
        se reflejan automáticamente al guardar.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.numero}
            href={`/empresas/${empresaId}/declaraciones/${declId}/anexos/${c.href}`}
            className="group block border border-border p-5 transition-colors hover:border-foreground"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  Anexo {c.numero}
                  {" · "}
                  Renglones{" "}
                  <span className="font-medium text-foreground">
                    {c.renglones.join(", ")}
                  </span>
                </p>
                <h3 className="mt-2 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
                  {c.titulo}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.descripcion}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                  Total
                </p>
                <p className="mt-1 font-serif text-2xl tracking-[-0.02em]">
                  {FMT.format(c.total)}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {c.items} {c.items === 1 ? "ítem" : "ítems"}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 border border-dashed border-border p-6">
        <h3 className="font-serif text-xl">Anexos no implementados</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Anexos del .xlsm modelo que se manejan desde el Balance Fiscal con
          ajustes débito/crédito en lugar de tener su propia interfaz.
        </p>
        <ul className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          {[
            "5 · Venta de Activos Fijos (cubierto parcialmente en Anexo 8)",
            "6 · Inventarios y Costo de Ventas",
            "7 · Conciliación Contable / Fiscal (cubierto en Balance Fiscal)",
            "16 · Activos Biológicos",
            "23 · Componente Inflacionario (derogado)",
            "24 · Reservas",
          ].map((a, i) => (
            <li key={i} className="font-mono text-xs text-muted-foreground">
              ◦ Anexo {a}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
