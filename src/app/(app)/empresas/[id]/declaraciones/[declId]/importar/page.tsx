import Link from "next/link";

export const metadata = { title: "Importar Balance" };

export default async function ImportarBalancePage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;

  return (
    <div className="max-w-2xl">
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
        Sube tu Balance de Prueba en formato Excel o CSV. Tribai lo procesa cuenta por
        cuenta y mapea cada PUC a los renglones del Formulario 110.
      </p>

      <div className="mt-10 border border-dashed border-border p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          Próximamente · Fase 4
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          El importador automático llega en la siguiente iteración. Por ahora puedes
          ingresar los valores manualmente en el editor.
        </p>
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}`}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
        >
          Ingresar manualmente
        </Link>
      </div>

      <h2 className="mt-16 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
        Estructura esperada
      </h2>
      <table className="mt-4 w-full border border-border text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
              Columna
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
            <td className="px-4 py-2 font-mono">A</td>
            <td className="px-4 py-2">Cuenta PUC (4 o 6 dígitos)</td>
            <td className="px-4 py-2 font-mono text-muted-foreground">110505</td>
          </tr>
          <tr className="border-t border-border">
            <td className="px-4 py-2 font-mono">B</td>
            <td className="px-4 py-2">Nombre de la cuenta</td>
            <td className="px-4 py-2 font-mono text-muted-foreground">Caja general</td>
          </tr>
          <tr className="border-t border-border">
            <td className="px-4 py-2 font-mono">C</td>
            <td className="px-4 py-2">Saldo a 31 de diciembre</td>
            <td className="px-4 py-2 font-mono text-muted-foreground">1,250,000</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
