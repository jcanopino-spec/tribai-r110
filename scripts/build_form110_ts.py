"""Convierte data/extracted/04_formulario_110.json en src/engine/catalogos/form110-2025.ts
con tipos TypeScript estables que consumira la UI."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "extracted" / "04_formulario_110.json"
OUT = ROOT / "src" / "engine" / "catalogos" / "form110-2025.ts"


def main():
    rows = json.loads(SRC.read_text(encoding="utf-8"))
    OUT.parent.mkdir(parents=True, exist_ok=True)

    lines: list[str] = []
    lines.append("// Generado automaticamente desde el .xlsm fuente.")
    lines.append("// No editar a mano. Regenerar con scripts/build_form110_ts.py")
    lines.append("")
    lines.append("export type Form110Section =")
    sections = sorted({r.get("seccion") or "Sin sección" for r in rows})
    for i, s in enumerate(sections):
        lines.append(f'  | "{s}"{";" if i == len(sections) - 1 else ""}')
    lines.append("")
    lines.append("export type Form110Renglon = {")
    lines.append("  numero: number;")
    lines.append("  descripcion: string;")
    lines.append("  seccion: Form110Section;")
    lines.append("  formulaXlsm: string | null;  // referencia original (auditable)")
    lines.append("  fuenteCelda: string | null;")
    lines.append("};")
    lines.append("")
    lines.append("export const FORM_110_2025: readonly Form110Renglon[] = [")
    for r in rows:
        seccion = (r.get("seccion") or "Sin sección").replace('"', '\\"')
        desc = r["descripcion"].replace("\\", "\\\\").replace('"', '\\"')
        formula = r.get("formula_xlsm")
        if formula is not None:
            formula = formula.replace("\\", "\\\\").replace('"', '\\"')
        celda = r.get("fuente_celda")
        lines.append("  {")
        lines.append(f"    numero: {r['numero']},")
        lines.append(f'    descripcion: "{desc}",')
        lines.append(f'    seccion: "{seccion}",')
        lines.append(f'    formulaXlsm: {f"""\"{formula}\"""" if formula else "null"},')
        lines.append(f'    fuenteCelda: {f"""\"{celda}\"""" if celda else "null"},')
        lines.append("  },")
    lines.append("] as const;")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Renglones: {len(rows)}")
    print(f"Output:    {OUT}")


if __name__ == "__main__":
    main()
