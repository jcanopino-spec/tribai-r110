#!/usr/bin/env python3
"""Genera src/engine/f2516-detalle.ts a partir del catálogo extraído del .xlsm.

El catálogo viene de data/extracted/06_detalle_fiscal_2516.json y representa
la estructura jerárquica del Detalle Fiscal del archivo guía v5: por cada
renglón del F110, las cuentas PUC que lo componen.

Uso:
    python3 scripts/build_f2516_detalle_ts.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "extracted" / "06_detalle_fiscal_2516.json"
DST = ROOT / "src" / "engine" / "f2516-detalle.ts"


def main():
    items = json.loads(SRC.read_text(encoding="utf-8"))

    # Filtrar a renglones-total y cuentas detalle (descartar markers vacíos)
    relevantes = [
        it for it in items
        if it["tipo"] in ("renglon_total", "cuenta")
    ]

    lines = [
        "// Catálogo del Detalle Fiscal · estructura completa del Formato 2516",
        "// extraída del archivo guía v5 (Tribai_R110_AG2025_v5_prueba_aries.xlsx",
        "// hoja \"Detalle Fiscal\").",
        "//",
        "// Cada renglón del F110 (R33 a R114) tiene asociadas las cuentas PUC",
        "// que lo componen en el balance contable. La estructura permite",
        "// generar el F2516 oficial DIAN agregando los saldos del balance por",
        "// prefijo PUC y mostrando la conciliación contable → fiscal.",
        "//",
        "// NO EDITAR A MANO. Regenerar con:",
        "//   python3 scripts/build_f2516_detalle_ts.py",
        "",
        "export type DetalleFiscalItem = {",
        "  /** Renglón F110 al que agrega esta cuenta (null para subtotales). */",
        "  rgl: number | null;",
        "  /** Código PUC. null para filas de total/sección. */",
        "  puc: string | null;",
        "  /** Concepto descriptivo. */",
        "  concepto: string;",
        "  /** \"renglon_total\" | \"cuenta\" */",
        "  tipo: \"renglon_total\" | \"cuenta\";",
        "};",
        "",
        "export const DETALLE_FISCAL_2516: readonly DetalleFiscalItem[] = [",
    ]
    for it in relevantes:
        rgl = it.get("rgl")
        try:
            rgl_n = int(rgl) if rgl else None
        except ValueError:
            rgl_n = None
        puc = it.get("puc") or ""
        concepto = (it.get("concepto") or "").replace('"', '\\"').replace("\n", " ")
        tipo = it["tipo"]
        rgl_str = str(rgl_n) if rgl_n is not None else "null"
        puc_str = f'"{puc}"' if puc else "null"
        lines.append(
            f'  {{ rgl: {rgl_str}, puc: {puc_str}, concepto: "{concepto}", tipo: "{tipo}" }},'
        )
    lines.append("];")
    lines.append("")
    lines.append(
        "/** Cuentas detalle agrupadas por renglón. Útil para reportar */"
    )
    lines.append(
        "/** la composición de cada renglón del F110 desde el balance.    */"
    )
    lines.append("export const CUENTAS_POR_RENGLON: ReadonlyMap<number, readonly string[]> =")
    lines.append("  (() => {")
    lines.append("    const m = new Map<number, string[]>();")
    lines.append("    let renglonActual: number | null = null;")
    lines.append("    for (const it of DETALLE_FISCAL_2516) {")
    lines.append("      if (it.tipo === \"renglon_total\" && it.rgl !== null) {")
    lines.append("        renglonActual = it.rgl;")
    lines.append("        if (!m.has(renglonActual)) m.set(renglonActual, []);")
    lines.append("      } else if (it.tipo === \"cuenta\" && it.puc && renglonActual !== null) {")
    lines.append("        const arr = m.get(renglonActual) ?? [];")
    lines.append("        arr.push(it.puc);")
    lines.append("        m.set(renglonActual, arr);")
    lines.append("      }")
    lines.append("    }")
    lines.append("    return m;")
    lines.append("  })();")
    lines.append("")

    DST.write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated {DST}")
    print(f"  Total items: {len(relevantes)}")
    renglones = [it for it in relevantes if it["tipo"] == "renglon_total"]
    cuentas = [it for it in relevantes if it["tipo"] == "cuenta"]
    print(f"  Renglones: {len(renglones)} · Cuentas: {len(cuentas)}")


if __name__ == "__main__":
    main()
