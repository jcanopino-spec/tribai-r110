"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TRIBAI_BRAND } from "@/lib/brand";

/**
 * Card "Papel de trabajo Tribai" · controla:
 *   - Botón "🔄 Actualizar cálculos" (recálculo en cascada + revalidate)
 *   - Botón "📄 Descargar Word" (papel de trabajo técnico-gerencial)
 *   - Botón "📊 Descargar Excel" (auditable, 11 hojas)
 *
 * El recálculo invalida el caché de TODAS las páginas hijas para que la
 * siguiente vista refleje los nuevos valores sin necesidad de F5.
 */
export function PapelTrabajoCard({
  declId,
  empresaId,
}: {
  declId: string;
  empresaId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  async function recalcular() {
    setStatus(null);
    try {
      const r = await fetch(`/api/declaracion/recalcular?decl=${declId}`, {
        method: "POST",
      });
      const json = await r.json();
      if (json.ok) {
        setStatus(`✓ ${json.message}`);
        // Refrescar todas las rutas del declId
        startTransition(() => router.refresh());
      } else {
        setStatus(`⨯ Error: ${json.error}`);
      }
    } catch (e) {
      setStatus(`⨯ Error de red: ${(e as Error).message}`);
    }
  }

  return (
    <div
      className="rounded-md border p-5"
      style={{
        borderColor: TRIBAI_BRAND.gold,
        background: `linear-gradient(135deg, ${TRIBAI_BRAND.ink} 0%, ${TRIBAI_BRAND.inkSecondary} 100%)`,
        color: TRIBAI_BRAND.paper,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl tracking-[-0.01em]">
            Papel de trabajo Tribai
          </h2>
          <p className="mt-1 text-xs" style={{ color: TRIBAI_BRAND.gold }}>
            El Estatuto, la calculadora y el criterio. Todo en uno.
          </p>
          <p className="mt-3 max-w-xl text-xs opacity-80">
            Genera el papel de trabajo técnico-gerencial completo con la
            normativa colombiana, conciliaciones, anexos y validaciones.
            Cada descarga refleja el estado más reciente.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={recalcular}
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition disabled:opacity-50"
          style={{
            backgroundColor: TRIBAI_BRAND.gold,
            color: TRIBAI_BRAND.ink,
          }}
          title="Recalcula todos los renglones del F110 desde el balance + anexos · invalida cachés de las páginas hijas"
        >
          {isPending ? "Actualizando…" : "🔄 Actualizar cálculos"}
        </button>

        <a
          href={`/api/papel-trabajo/word?decl=${declId}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition hover:bg-white/10"
          style={{ borderColor: TRIBAI_BRAND.paper, color: TRIBAI_BRAND.paper }}
          title="Documento Word con identidad Tribai para enviar a revisoría fiscal y auditores"
        >
          📄 Papel de trabajo (Word)
        </a>

        <a
          href={`/api/papel-trabajo/excel?decl=${declId}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition hover:bg-white/10"
          style={{ borderColor: TRIBAI_BRAND.paper, color: TRIBAI_BRAND.paper }}
          title="Libro Excel con 11 hojas conectadas para auditoría detallada"
        >
          📊 Papel de trabajo (Excel)
        </a>

        <a
          href={`/api/papel-trabajo-rf/excel?decl=${declId}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition"
          style={{ backgroundColor: TRIBAI_BRAND.gold, color: TRIBAI_BRAND.ink }}
          title="Papel de trabajo Revisoría Fiscal · 26 hojas · arquitectura modelo guía DIAN · fórmulas SUMIFS cross-sheet"
        >
          🏛️ Anexo Revisoría Fiscal
        </a>
      </div>

      {status && (
        <p
          className="mt-3 rounded-md px-3 py-2 text-xs"
          style={{
            backgroundColor: status.startsWith("✓") ? "#1B5E20" : "#B71C1C",
            color: TRIBAI_BRAND.paper,
          }}
        >
          {status}
        </p>
      )}

      <p className="mt-4 text-[10px] opacity-60">
        © 2026 INPLUX SAS · NIT 901.784.448-8 · Marca Tribai · {" "}
        <a href="https://tribai.co" target="_blank" rel="noopener" style={{ color: TRIBAI_BRAND.gold }}>
          tribai.co
        </a>
      </p>
    </div>
  );
}
