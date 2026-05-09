import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  BENEFICIOS,
  beneficiosAplicablesPorRegimen,
  type BeneficioModalidad,
} from "@/engine/beneficios";

export const metadata = { title: "Beneficios Tributarios" };

const FMT_PCT = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 0,
});

const MODALIDAD_LABEL: Record<BeneficioModalidad, string> = {
  renta_exenta: "Renta exenta · Anexo 19",
  tarifa_especial: "Tarifa especial · régimen",
  regimen_completo: "Régimen completo",
};

export default async function BeneficiosPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, empresa_id")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("razon_social, regimen_codigo")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  const regimenCodigo = empresa.regimen_codigo;
  const aplicables = new Set(beneficiosAplicablesPorRegimen(regimenCodigo));

  return (
    <div className="max-w-5xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Anexos
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Beneficios Tributarios
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Catálogo informativo de los beneficios tributarios especiales
            disponibles para personas jurídicas. La mayoría se aplican
            eligiendo el régimen correcto en la empresa o capturando rentas
            exentas en el Anexo 19. Esta vista te ayuda a verificar que la
            configuración del régimen actual refleje los beneficios que
            quieres reclamar.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
            {empresa.razon_social}
          </p>
          <p className="font-mono text-xs">
            Régimen{" "}
            <span className="font-medium">
              {regimenCodigo ?? "sin asignar"}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-foreground text-left">
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                #
              </th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Beneficio
              </th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Base legal
              </th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Modalidad
              </th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Tarifa típica
              </th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {BENEFICIOS.map((b) => {
              const aplica = aplicables.has(b.id);
              return (
                <tr
                  key={b.id}
                  className={`border-b border-border align-top ${
                    aplica ? "bg-success/5" : ""
                  }`}
                >
                  <td className="px-2 py-2 font-mono text-xs text-muted-foreground tabular-nums">
                    {b.numero}
                  </td>
                  <td className="px-2 py-2 text-sm">
                    <p className="font-medium">{b.nombre}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {b.descripcion}
                    </p>
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground">
                    {b.baseLegal}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {MODALIDAD_LABEL[b.modalidad]}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">
                    {b.tarifaTipica !== null
                      ? FMT_PCT.format(b.tarifaTipica)
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {aplica ? (
                      <span className="font-medium text-success">
                        ✓ Aplica al régimen actual
                      </span>
                    ) : b.regimenesAplicables.length > 0 ? (
                      <span className="text-muted-foreground">
                        Cambia a régimen{" "}
                        <span className="font-mono">
                          {b.regimenesAplicables.join(" / ")}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Captura en Anexo 19
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <div className="border border-border p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">¿Cómo aplicar un beneficio?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">Regímenes ligados</span> ·
              Cambia el régimen de la empresa al código que corresponde (03 ZESE,
              04/05/06 ZF, 09 hoteles, 11 editoriales). La tarifa se actualiza
              automáticamente en R84.
            </li>
            <li>
              <span className="font-medium text-foreground">Rentas exentas</span> ·
              Para Economía Naranja, Desarrollo Rural y otros casos del Art. 235-2,
              captura el monto exento en el Anexo 19. Alimenta R77 del 110.
            </li>
            <li>
              <span className="font-medium text-foreground">Tarifa progresiva (ZOMAC)</span>{" "}
              · Hoy no hay un código de régimen específico — necesitarás ajustar
              manualmente o captura como renta exenta según corresponda.
            </li>
          </ul>
        </div>
        <div className="border border-border p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Coherencia con TTD y sobretasa</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              ZESE, Zona Franca y régimenes especiales ya están en el catálogo
              de exclusiones de la Tasa Mínima de Tributación · ver
              `engine/condicionales.ts`.
            </li>
            <li>
              Si cambias el régimen, regresa a `/configuracion` para verificar
              que los flags TTD y sobretasa quedaron consistentes con el
              nuevo régimen.
            </li>
            <li>
              Esta vista es <span className="font-medium">informativa</span>:
              no captura datos ni alimenta renglones por sí misma.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
