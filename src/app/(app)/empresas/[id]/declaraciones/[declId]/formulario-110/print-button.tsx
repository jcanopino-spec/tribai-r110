"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-xs font-medium text-background transition-opacity hover:opacity-90"
    >
      Imprimir / Guardar PDF
    </button>
  );
}
