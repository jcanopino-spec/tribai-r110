// Nav lateral de las 7 hojas oficiales del F2516.
// Identidad visual Tribai (ink + gold).

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TRIBAI_BRAND } from "@/lib/brand";

export type HojaItem = {
  href: string;
  codigo: string;
  titulo: string;
  ayuda: string;
};

export function Hojas2516Nav({
  empresaId,
  declId,
}: {
  empresaId: string;
  declId: string;
}) {
  const pathname = usePathname();
  const base = `/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`;
  const hojas: HojaItem[] = [
    { href: base, codigo: "—", titulo: "Vista compacta", ayuda: "18 filas DIAN" },
    { href: `${base}/h1-caratula`, codigo: "H1", titulo: "Carátula", ayuda: "Datos del declarante" },
    { href: `${base}/h2-esf`, codigo: "H2", titulo: "ESF", ayuda: "Estado Situación Financiera" },
    { href: `${base}/h3-eri`, codigo: "H3", titulo: "ERI", ayuda: "Estado Resultados Integral" },
    { href: `${base}/h4-impuesto-diferido`, codigo: "H4", titulo: "Imp Diferido", ayuda: "NIC 12" },
    { href: `${base}/h5-ingresos-facturacion`, codigo: "H5", titulo: "Ingresos y Facturación", ayuda: "Cruce factura electrónica" },
    { href: `${base}/h6-activos-fijos`, codigo: "H6", titulo: "Activos Fijos", ayuda: "Movimiento PP&E" },
    { href: `${base}/h7-resumen`, codigo: "H7", titulo: "Resumen ESF/ERI", ayuda: "Validaciones cruzadas" },
  ];

  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {hojas.map((h) => {
        const active = pathname === h.href;
        return (
          <Link
            key={h.href}
            href={h.href}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
              active ? "shadow-sm" : "hover:bg-muted/50"
            }`}
            style={
              active
                ? {
                    backgroundColor: TRIBAI_BRAND.ink,
                    color: TRIBAI_BRAND.paper,
                    borderColor: TRIBAI_BRAND.ink,
                  }
                : { borderColor: "var(--border)" }
            }
            title={h.ayuda}
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded font-mono text-[10px] font-bold"
              style={{
                backgroundColor: active ? TRIBAI_BRAND.gold : "transparent",
                color: active ? TRIBAI_BRAND.ink : TRIBAI_BRAND.gold,
                border: active ? "none" : `1px solid ${TRIBAI_BRAND.gold}`,
              }}
            >
              {h.codigo}
            </span>
            <span className="font-medium">{h.titulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}
