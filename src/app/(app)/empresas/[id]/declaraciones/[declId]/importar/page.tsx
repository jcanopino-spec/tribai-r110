import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Importar Balance" };

export default async function ImportarBalancePage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: ultimoBalance } = await supabase
    .from("balance_pruebas")
    .select("filename, uploaded_at")
    .eq("declaracion_id", declId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-3xl">
      <Link
        href={`/empresas/${empresaId}/declaraciones/${declId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← Volver al editor
      </Link>

      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
        Importar Balance de Prueba
      </h1>
      <p className="mt-3 text-muted-foreground">
        Sube tu Balance de Prueba en Excel o CSV. Tribai detecta los encabezados,
        normaliza los códigos PUC y mapea cada cuenta al renglón correspondiente del
        Formulario 110 usando 3 355 mapeos pre-cargados.
      </p>

      <div className="mt-10">
        <UploadForm
          declId={declId}
          empresaId={empresaId}
          yaCargado={ultimoBalance ?? null}
        />
      </div>

      <h2 className="mt-16 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
        Estructura esperada
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Tribai detecta los encabezados automáticamente. Solo necesitas que tu archivo
        tenga columnas con estos nombres (en cualquier orden):
      </p>
      <table className="mt-4 w-full border border-border text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Encabezado contiene
            </th>
            <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Contenido
            </th>
            <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Ejemplo
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <td className="px-4 py-2 font-mono">cuenta · puc · código</td>
            <td className="px-4 py-2">Cuenta PUC (4 o 6 dígitos; puntos opcionales)</td>
            <td className="px-4 py-2 font-mono text-muted-foreground">110505</td>
          </tr>
          <tr className="border-t border-border">
            <td className="px-4 py-2 font-mono">nombre · descripción</td>
            <td className="px-4 py-2">Nombre de la cuenta (opcional)</td>
            <td className="px-4 py-2 font-mono text-muted-foreground">Caja general</td>
          </tr>
          <tr className="border-t border-border">
            <td className="px-4 py-2 font-mono">saldo · valor</td>
            <td className="px-4 py-2">Saldo a 31 de diciembre (acepta es-CO o en-US)</td>
            <td className="px-4 py-2 font-mono text-muted-foreground">1.250.000</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-4 text-xs text-muted-foreground">
        Solo se agregan a los renglones del 110 las cuentas auxiliares (6 dígitos) para
        evitar duplicaciones por niveles. Las cuentas de mayor (2 y 4 dígitos) se
        guardan como referencia en las líneas pero no se suman al renglón.
      </p>
    </div>
  );
}
