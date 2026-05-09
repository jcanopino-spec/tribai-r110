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
  ID_CATEGORIAS,
  TARIFA_ID_DEFAULT,
  calcularFilaID,
  resumenID,
  categorizarPucPasivosID,
} from "@/engine/impuesto-diferido";

export const metadata = { title: "Impuesto Diferido" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function ImpuestoDiferidoPage({
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

  // Tarifa del régimen (la usamos como tarifa por defecto del ID)
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
  const tarifaID = tarifaRegimen && tarifaRegimen > 0 ? tarifaRegimen : TARIFA_ID_DEFAULT;

  // Compute F110 (necesario para que el F2516 entregue Fiscal correcto)
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

  // F2516 nos da la base contable y la base fiscal de cada activo del ESF
  const f2516Filas = await loadF2516Aggregates(supabase, declId, numerico);
  const f2516Map = new Map(f2516Filas.map((f) => [f.fila.id, f]));

  // Cargar bases de PASIVOS agregadas por subprefijo PUC
  // (clase 2 viene en negativo, lo absolutizamos para mostrarlo en positivo).
  const pasivosBases = new Map<
    string,
    { contable: number; fiscal: number }
  >();
  const { data: balance } = await supabase
    .from("balance_pruebas")
    .select("id")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (balance) {
    const { data: lineas } = await supabase
      .from("balance_prueba_lineas")
      .select("cuenta, saldo, ajuste_debito, ajuste_credito")
      .eq("balance_id", balance.id);
    for (const l of lineas ?? []) {
      const catId = categorizarPucPasivosID(l.cuenta);
      if (!catId) continue;
      const saldoContable = Math.abs(Number(l.saldo));
      const saldoFiscal = Math.abs(
        Number(l.saldo) + Number(l.ajuste_debito) - Number(l.ajuste_credito),
      );
      const prev = pasivosBases.get(catId) ?? { contable: 0, fiscal: 0 };
      pasivosBases.set(catId, {
        contable: prev.contable + saldoContable,
        fiscal: prev.fiscal + saldoFiscal,
      });
    }
  }

  // Calcular cada categoría del ID
  const filasID = ID_CATEGORIAS.map((cat) => {
    let baseContable = 0;
    let baseFiscal = 0;
    if (cat.tipo === "activo" && cat.f2516FilaId) {
      const f = f2516Map.get(cat.f2516FilaId);
      if (f) {
        baseContable = f.contable;
        baseFiscal = f.fiscal;
      }
    } else if (cat.tipo === "pasivo") {
      const b = pasivosBases.get(cat.id);
      if (b) {
        baseContable = b.contable;
        baseFiscal = b.fiscal;
      }
    }
    return calcularFilaID({ categoria: cat, baseContable, baseFiscal, tarifa: tarifaID });
  });

  const resumen = resumenID(filasID);
  const activos = filasID.filter((f) => f.categoria.tipo === "activo");
  const pasivos = filasID.filter((f) => f.categoria.tipo === "pasivo");
  const totalDifDedActivos = activos.reduce((s, f) => s + f.difDeducible, 0);
  const totalDifImpActivos = activos.reduce((s, f) => s + f.difImponible, 0);
  const totalActivosBase = activos.reduce(
    (s, f) => ({ c: s.c + f.baseContable, f: s.f + f.baseFiscal }),
    { c: 0, f: 0 },
  );

  return (
    <div className="max-w-6xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Conciliaciones
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Impuesto Diferido
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            NIC 12 · Sección 29 NIIF Pymes. Surge de las diferencias{" "}
            <span className="font-medium">temporarias</span> entre la base
            contable y la base fiscal de activos y pasivos. Las bases vienen
            del Formato 2516 (contable = saldo del balance · fiscal =
            contable + ajustes).
          </p>
          <p className="mt-2 text-xs font-mono uppercase tracking-[0.08em] text-muted-foreground">
            TARIFA APLICADA · {(tarifaID * 100).toFixed(0)}%
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/conciliaciones/impuesto-diferido/export?decl=${declId}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-secondary px-5 text-sm hover:bg-muted"
            title="Descarga el Impuesto Diferido en .xlsx para entregar a auditoría externa"
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

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Stat
          label="Activo por ID"
          value={FMT.format(resumen.totalActivoID)}
          help="Diferencias DEDUCIBLES × tarifa"
        />
        <Stat
          label="Pasivo por ID"
          value={FMT.format(resumen.totalPasivoID)}
          help="Diferencias IMPONIBLES × tarifa"
        />
        <Stat
          label={resumen.gastoIngresoNeto >= 0 ? "Gasto neto por ID" : "Ingreso neto por ID"}
          value={FMT.format(Math.abs(resumen.gastoIngresoNeto))}
          alert={resumen.gastoIngresoNeto !== 0}
          help="Pasivo ID − Activo ID"
        />
      </div>

      <Tabla
        titulo="Activos · diferencias temporarias"
        filas={activos}
        totalDeducible={totalDifDedActivos}
        totalImponible={totalDifImpActivos}
        totalBaseContable={totalActivosBase.c}
        totalBaseFiscal={totalActivosBase.f}
      />

      <Tabla
        titulo="Pasivos · diferencias temporarias"
        filas={pasivos}
        totalDeducible={pasivos.reduce((s, f) => s + f.difDeducible, 0)}
        totalImponible={pasivos.reduce((s, f) => s + f.difImponible, 0)}
        totalBaseContable={pasivos.reduce((s, f) => s + f.baseContable, 0)}
        totalBaseFiscal={pasivos.reduce((s, f) => s + f.baseFiscal, 0)}
      />

      <div className="mt-8 border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Reglas de signo</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-foreground">Activos</span>: si
            BASE FISCAL &gt; CONTABLE → diferencia DEDUCIBLE (genera Activo
            por ID). Si CONTABLE &gt; FISCAL → IMPONIBLE (genera Pasivo).
          </li>
          <li>
            <span className="font-medium text-foreground">Pasivos</span>:
            signos invertidos. Si CONTABLE &gt; FISCAL → DEDUCIBLE.
          </li>
          <li>
            <span className="font-medium text-foreground">Pasivos por subprefijo PUC</span>:{" "}
            las 7 categorías se llenan automáticamente clasificando cada
            cuenta clase 2 según su prefijo (21xx oblig. financieras,
            22xx proveedores, 23xx CxP, 24xx impuestos por pagar, 25xx
            laborales, 26xx provisiones, 27/28/29xx otros). Si tu balance
            no usa el PUC oficial, las cuentas sin clasificar no aparecen.
          </li>
          <li>
            <span className="font-medium text-foreground">Tarifa</span>:
            por defecto la del régimen ({(tarifaID * 100).toFixed(0)}%). Si
            la empresa aplica una tarifa especial NIIF distinta, esta vista
            la considera tarifa única.
          </li>
        </ul>
      </div>
    </div>
  );
}

type FilaCalc = ReturnType<typeof calcularFilaID>;

function Tabla({
  titulo,
  filas,
  totalDeducible,
  totalImponible,
  totalBaseContable,
  totalBaseFiscal,
}: {
  titulo: string;
  filas: FilaCalc[];
  totalDeducible: number;
  totalImponible: number;
  totalBaseContable: number;
  totalBaseFiscal: number;
}) {
  const totalIDA = filas.reduce((s, f) => s + f.idActivo, 0);
  const totalIDP = filas.reduce((s, f) => s + f.idPasivo, 0);
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {titulo}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-foreground text-left">
              <Th>#</Th>
              <Th>Concepto</Th>
              <Th align="right">Base Contable</Th>
              <Th align="right">Base Fiscal</Th>
              <Th align="right">Dif. Deducible</Th>
              <Th align="right">Dif. Imponible</Th>
              <Th align="right">ID Activo</Th>
              <Th align="right">ID Pasivo</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.categoria.id} className="border-b border-border text-xs">
                <Td>{f.categoria.numero}</Td>
                <Td>{f.categoria.label}</Td>
                <NumTd v={f.baseContable} />
                <NumTd v={f.baseFiscal} />
                <NumTd v={f.difDeducible} />
                <NumTd v={f.difImponible} />
                <NumTd v={f.idActivo} bold />
                <NumTd v={f.idPasivo} bold />
              </tr>
            ))}
            <tr className="border-b-2 border-foreground bg-muted/30 text-xs font-semibold">
              <Td colSpan={2}>SUBTOTAL</Td>
              <NumTd v={totalBaseContable} />
              <NumTd v={totalBaseFiscal} />
              <NumTd v={totalDeducible} />
              <NumTd v={totalImponible} />
              <NumTd v={totalIDA} bold />
              <NumTd v={totalIDP} bold />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  colSpan,
}: {
  children: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <td className="px-2 py-1.5 text-sm" colSpan={colSpan}>
      {children}
    </td>
  );
}

function NumTd({ v, bold }: { v: number; bold?: boolean }) {
  return (
    <td className={`px-2 py-1.5 text-right font-mono text-xs tabular-nums ${bold ? "font-semibold" : ""}`}>
      {v === 0 ? "" : FMT.format(v)}
    </td>
  );
}

function Stat({
  label,
  value,
  help,
  alert,
}: {
  label: string;
  value: string;
  help?: string;
  alert?: boolean;
}) {
  const cls = alert ? "border-foreground bg-muted/40" : "border-border";
  return (
    <div className={`border p-4 ${cls}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl tracking-[-0.02em] tabular-nums">{value}</p>
      {help ? <p className="mt-1 text-[10px] text-muted-foreground">{help}</p> : null}
    </div>
  );
}
