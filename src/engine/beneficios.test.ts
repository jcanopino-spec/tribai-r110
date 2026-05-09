import { describe, it, expect } from "vitest";
import {
  BENEFICIOS,
  beneficiosAplicablesPorRegimen,
  getBeneficio,
} from "./beneficios";

describe("BENEFICIOS · catálogo", () => {
  it("tiene 7 entradas", () => {
    expect(BENEFICIOS.length).toBe(7);
  });

  it("ids únicos", () => {
    const ids = BENEFICIOS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("numeración 1..7 sin saltos", () => {
    const numeros = BENEFICIOS.map((b) => b.numero);
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("cada entrada tiene base legal", () => {
    for (const b of BENEFICIOS) {
      expect(b.baseLegal).toBeTruthy();
      expect(b.nombre).toBeTruthy();
      expect(b.descripcion).toBeTruthy();
    }
  });
});

describe("beneficiosAplicablesPorRegimen", () => {
  it("régimen 03 (ZESE) → ZESE aplica", () => {
    expect(beneficiosAplicablesPorRegimen("03")).toContain("ZESE");
  });

  it("régimen 04 (ZF Comercial) → ZONA_FRANCA aplica", () => {
    expect(beneficiosAplicablesPorRegimen("04")).toContain("ZONA_FRANCA");
  });

  it("régimen 05 (ZF No Comercial) → ZONA_FRANCA aplica", () => {
    expect(beneficiosAplicablesPorRegimen("05")).toContain("ZONA_FRANCA");
  });

  it("régimen 06 (ZF Cúcuta) → ZONA_FRANCA aplica", () => {
    expect(beneficiosAplicablesPorRegimen("06")).toContain("ZONA_FRANCA");
  });

  it("régimen 09 (hoteles) → HOTELES aplica", () => {
    expect(beneficiosAplicablesPorRegimen("09")).toContain("HOTELES");
  });

  it("régimen 11 (editoriales) → EDITORIALES aplica", () => {
    expect(beneficiosAplicablesPorRegimen("11")).toContain("EDITORIALES");
  });

  it("régimen general 01 → sin beneficios ligados", () => {
    expect(beneficiosAplicablesPorRegimen("01")).toEqual([]);
  });

  it("régimen 02 (cooperativas) → sin beneficios ligados", () => {
    expect(beneficiosAplicablesPorRegimen("02")).toEqual([]);
  });

  it("null/undefined/vacío → []", () => {
    expect(beneficiosAplicablesPorRegimen(null)).toEqual([]);
    expect(beneficiosAplicablesPorRegimen(undefined)).toEqual([]);
    expect(beneficiosAplicablesPorRegimen("")).toEqual([]);
  });

  it("acepta código sin padding", () => {
    expect(beneficiosAplicablesPorRegimen("3")).toContain("ZESE");
    expect(beneficiosAplicablesPorRegimen("9")).toContain("HOTELES");
  });
});

describe("getBeneficio · lookup", () => {
  it("encuentra por id", () => {
    const b = getBeneficio("ZESE");
    expect(b).toBeDefined();
    expect(b!.numero).toBe(3);
    expect(b!.modalidad).toBe("regimen_completo");
  });

  it("ECON_NARANJA es renta_exenta sin régimen ligado", () => {
    const b = getBeneficio("ECON_NARANJA");
    expect(b!.modalidad).toBe("renta_exenta");
    expect(b!.regimenesAplicables).toEqual([]);
  });

  it("HOTELES es tarifa_especial al 9%", () => {
    const b = getBeneficio("HOTELES");
    expect(b!.modalidad).toBe("tarifa_especial");
    expect(b!.tarifaTipica).toBe(0.09);
  });
});
