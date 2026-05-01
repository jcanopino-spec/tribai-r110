"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
    >
      Imprimir / Guardar PDF
    </button>
  );
}
