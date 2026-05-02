import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ultimoDigitoNit, evaluarPresentacion } from "@/lib/forms/vencimientos";
import { ConfiguracionForm } from "./form";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage({
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
    .select("razon_social, regimen_codigo, nit")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  // Calcular vencimiento sugerido por NIT + tipo
  const tipo = declaracion.es_gran_contribuyente ? "gran_contribuyente" : "persona_juridica";
  const digito = ultimoDigitoNit(empresa.nit);
  let vencimientoSugerido: string | null = null;
  if (digito !== null) {
    const { data } = await supabase
      .from("vencimientos_form110")
      .select("fecha_vencimiento")
      .eq("ano_gravable", declaracion.ano_gravable)
      .eq("tipo_contribuyente", tipo)
      .eq("ultimo_digito", digito)
      .maybeSingle();
    vencimientoSugerido = data?.fecha_vencimiento ?? null;
  }

  const fechaVencimientoEfectiva = declaracion.fecha_vencimiento ?? vencimientoSugerido;
  const evaluacion = evaluarPresentacion(
    fechaVencimientoEfectiva,
    declaracion.fecha_presentacion,
  );

  return (
    <div className="max-w-4xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Configuración de la declaración
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Parámetros que inciden en el cálculo: características de la empresa, beneficios
        fiscales, datos del año anterior y sanciones. Todos se guardan en la declaración
        y se aplican automáticamente al formulario.
      </p>

      <div className="mt-10">
        <ConfiguracionForm
          declId={declId}
          empresaId={empresaId}
          razonSocial={empresa.razon_social}
          regimenCodigo={empresa.regimen_codigo}
          declaracion={declaracion}
          vencimientoSugerido={vencimientoSugerido}
          evaluacion={evaluacion}
          ultimoDigitoNit={digito}
        />
      </div>
    </div>
  );
}
