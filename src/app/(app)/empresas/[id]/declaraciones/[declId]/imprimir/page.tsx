import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  RENGLONES_COMPUTADOS,
  computarRenglones,
  normalizarSigno,
} from "@/lib/forms/form110-compute";
import { ultimoDigitoNit, evaluarPresentacion } from "@/lib/forms/vencimientos";
import { PrintButton } from "./print-button";

export const metadata = {
  title: "Imprimir declaración",
};

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function ImprimirDeclaracionPage({
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

  const regimenCodigo = empresa.regimen_codigo;

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

  // Resolver vencimiento auto + UVT vigente para sanción
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

  const { data: retenciones } = await supabase
    .from("anexo_retenciones")
    .select("tipo, retenido")
    .eq("declaracion_id", declId);
  const totalAutorretenciones = (retenciones ?? [])
    .filter((r) => r.tipo === "autorretencion")
    .reduce((s, r) => s + Number(r.retenido), 0);
  const totalRetenciones = (retenciones ?? [])
    .filter((r) => r.tipo === "retencion")
    .reduce((s, r) => s + Number(r.retenido), 0);

  const { data: descuentos } = await supabase
    .from("anexo_descuentos")
    .select("valor_descuento")
    .eq("declaracion_id", declId);
  const totalDescuentosTributarios = (descuentos ?? []).reduce(
    (s, d) => s + Number(d.valor_descuento),
    0,
  );

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

  // Normaliza y computa
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
    patrimonioLiquidoAnterior,
    esInstitucionFinanciera: !!declaracion.es_institucion_financiera,
    totalNomina: Number(declaracion.total_nomina ?? 0),
    aportesSegSocial: Number(declaracion.aportes_seg_social ?? 0),
    aportesParaFiscales: Number(declaracion.aportes_para_fiscales ?? 0),
    totalAutorretenciones,
    totalRetenciones,
    totalDescuentosTributarios,
  });

  const porSeccion = new Map<string, typeof renglones>();
  for (const r of renglones ?? []) {
    const arr = porSeccion.get(r.seccion) ?? [];
    arr.push(r);
    porSeccion.set(r.seccion, arr);
  }

  return (
    <div className="print-page mx-auto max-w-[210mm] bg-card px-10 py-8 text-sm">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-page { max-width: none; padding: 0; box-shadow: none; }
        }
      `}</style>

      <header className="flex items-start justify-between border-b border-border pb-4">
        <div>
          <Image src="/brand/logo-tribai-full.svg" alt="Tribai" width={108} height={26} />
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Formulario {declaracion.formato} · AG {declaracion.ano_gravable} · {declaracion.estado}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Generado {new Date().toLocaleString("es-CO")}
        </div>
      </header>

      <section className="mt-6">
        <h1 className="font-serif text-2xl leading-tight tracking-[-0.02em]">
          {empresa.razon_social}
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          NIT {empresa.nit}{empresa.dv ? `-${empresa.dv}` : ""} ·{" "}
          CIIU {empresa.ciiu_codigo ?? "—"} ·{" "}
          DIAN {empresa.direccion_seccional_codigo ?? "—"} ·{" "}
          Régimen {regimenCodigo ?? "—"}
          {tarifaRegimen != null ? ` (tarifa ${(tarifaRegimen * 100).toFixed(2)}%)` : ""}
        </p>
      </section>

      <div className="no-print mt-6 flex justify-end">
        <PrintButton />
      </div>

      <div className="mt-6 space-y-6">
        {Array.from(porSeccion.entries()).map(([seccion, items]) => (
          <section key={seccion} className="break-inside-avoid">
            <h2 className="border-b border-border pb-1 font-serif text-lg">{seccion}</h2>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {items?.map((r) => {
                  const valor = numerico.get(r.numero) ?? 0;
                  const isComputado = RENGLONES_COMPUTADOS.has(r.numero);
                  return (
                    <tr key={r.numero} className="border-b border-border">
                      <td className="w-12 py-1 align-top font-mono text-muted-foreground">
                        {r.numero}
                      </td>
                      <td className="py-1 pr-4 align-top">{r.descripcion}</td>
                      <td
                        className={`w-32 py-1 text-right align-top font-mono ${
                          isComputado ? "font-medium" : ""
                        }`}
                      >
                        {valor === 0 ? "" : FMT.format(valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
        Generado por Tribai · tribai.co · Documento de trabajo, no oficial.
        Antes de presentar a la DIAN, valida los valores en el sistema MUISCA.
      </footer>
    </div>
  );
}
