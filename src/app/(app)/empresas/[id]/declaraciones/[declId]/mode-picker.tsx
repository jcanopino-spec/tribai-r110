import { setModoCargaAction } from "./actions";

export function ModePicker({ declId, empresaId }: { declId: string; empresaId: string }) {
  const elegir = setModoCargaAction.bind(null, declId, empresaId);

  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2">
      <form action={elegir.bind(null, "balance")}>
        <button
          type="submit"
          className="group block w-full border border-border p-8 text-left transition-colors hover:border-foreground"
        >
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Opción 1 · Recomendado
          </p>
          <h3 className="mt-4 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
            Importar Balance de Prueba
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Sube tu Balance de Prueba en Excel o CSV. Tribai mapea cada cuenta PUC al
            renglón correspondiente del 110 usando 3 355 mapeos pre-cargados.
          </p>
          <p className="mt-6 inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-xs text-primary-foreground transition-opacity group-hover:opacity-90">
            Cargar archivo →
          </p>
        </button>
      </form>

      <form action={elegir.bind(null, "manual")}>
        <button
          type="submit"
          className="group block w-full border border-border p-8 text-left transition-colors hover:border-foreground"
        >
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Opción 2
          </p>
          <h3 className="mt-4 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
            Ingresar manualmente
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Digita los valores de cada renglón directamente. Útil si ya tienes los totales
            calculados o si ajustas valores específicos sobre un balance previo.
          </p>
          <p className="mt-6 inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs transition-colors group-hover:bg-muted">
            Empezar a digitar →
          </p>
        </button>
      </form>
    </div>
  );
}
