// Header de módulo · replica la identidad visual del .xlsm guía v5
// (banner azul oscuro #0A1628, título blanco grande, sub-label dorado
// #C4952A, link de retorno).
//
// Uso típico:
//   <ModuloHeader
//     titulo="DASHBOARD"
//     moduloLabel="Resumen Ejecutivo"
//     volverHref={`/empresas/${empresaId}`}
//     volverLabel="Empresa"
//     contexto="ARIES SAS · NIT 900.123.456-7 · AG 2025"
//   />

import Link from "next/link";
import { TRIBAI_BRAND } from "@/lib/brand";

export type ModuloHeaderProps = {
  titulo: string;
  moduloLabel: string;
  volverHref: string;
  volverLabel?: string;
  contexto?: string;
  /** Acciones a la derecha (botones, descargas). */
  acciones?: React.ReactNode;
};

export function ModuloHeader({
  titulo,
  moduloLabel,
  volverHref,
  volverLabel = "Volver",
  contexto,
  acciones,
}: ModuloHeaderProps) {
  return (
    <header
      className="mb-8 rounded-md border"
      style={{ backgroundColor: TRIBAI_BRAND.ink, borderColor: TRIBAI_BRAND.inkSecondary }}
    >
      <div className="flex flex-wrap items-center gap-4 px-6 py-4">
        <Link
          href={volverHref}
          className="font-mono text-xs font-medium uppercase tracking-[0.08em] hover:underline"
          style={{ color: TRIBAI_BRAND.gold }}
        >
          ← {volverLabel}
        </Link>

        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1
              className="font-serif text-3xl font-bold uppercase tracking-[0.02em] leading-none"
              style={{ color: TRIBAI_BRAND.paper }}
            >
              {titulo}
            </h1>
            <span
              className="font-mono text-xs uppercase tracking-[0.1em]"
              style={{ color: TRIBAI_BRAND.gold }}
            >
              {moduloLabel}
            </span>
          </div>
          {contexto ? (
            <p
              className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] opacity-70"
              style={{ color: TRIBAI_BRAND.paper }}
            >
              {contexto}
            </p>
          ) : null}
        </div>

        {acciones ? (
          <div className="flex flex-wrap items-center gap-2">{acciones}</div>
        ) : null}
      </div>
    </header>
  );
}
