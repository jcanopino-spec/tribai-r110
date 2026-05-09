import { describe, it, expect } from "vitest";
import {
  UMBRAL_PATRIMONIO_UVT,
  UMBRAL_INGRESOS_UVT,
  METODOS_PT,
  evaluarObligacionPT,
} from "./precios-transferencia";

const UVT_2024 = 47_065;
const UVT_2025 = 49_799;

describe("constantes PT", () => {
  it("umbrales según Art. 260-9 E.T.", () => {
    expect(UMBRAL_PATRIMONIO_UVT).toBe(100_000);
    expect(UMBRAL_INGRESOS_UVT).toBe(61_000);
  });

  it("6 métodos PT del Art. 260-3", () => {
    expect(METODOS_PT.length).toBe(6);
    const codigos = METODOS_PT.map((m) => m.codigo);
    expect(codigos).toEqual(["PC", "PR", "CA", "MTU", "PU", "RPU"]);
  });
});

describe("evaluarObligacionPT", () => {
  it("ambos por debajo de umbrales → no obligado", () => {
    const r = evaluarObligacionPT({
      patrimonioBrutoAnterior: 1_000_000_000,
      ingresosBrutosActual: 1_000_000_000,
      uvtAnterior: UVT_2024,
      uvtActual: UVT_2025,
    });
    expect(r.obligado).toBe(false);
    expect(r.causa).toBe(null);
  });

  it("patrimonio supera → obligado por patrimonio", () => {
    const r = evaluarObligacionPT({
      patrimonioBrutoAnterior: 5_000_000_000_000, // muy alto
      ingresosBrutosActual: 100_000_000,
      uvtAnterior: UVT_2024,
      uvtActual: UVT_2025,
    });
    expect(r.obligado).toBe(true);
    expect(r.patrimonioSupera).toBe(true);
    expect(r.ingresosSupera).toBe(false);
    expect(r.causa).toMatch(/Patrimonio bruto/);
  });

  it("ingresos supera → obligado por ingresos", () => {
    const r = evaluarObligacionPT({
      patrimonioBrutoAnterior: 100_000_000,
      ingresosBrutosActual: 5_000_000_000_000, // muy alto
      uvtAnterior: UVT_2024,
      uvtActual: UVT_2025,
    });
    expect(r.obligado).toBe(true);
    expect(r.ingresosSupera).toBe(true);
    expect(r.causa).toMatch(/Ingresos brutos/);
  });

  it("ambos superan → causa indica ambos", () => {
    const r = evaluarObligacionPT({
      patrimonioBrutoAnterior: 5_000_000_000_000,
      ingresosBrutosActual: 5_000_000_000_000,
      uvtAnterior: UVT_2024,
      uvtActual: UVT_2025,
    });
    expect(r.obligado).toBe(true);
    expect(r.causa).toMatch(/ambos/);
  });

  it("exactamente en el umbral → obligado (>=)", () => {
    const patrimonio = UMBRAL_PATRIMONIO_UVT * UVT_2024;
    const r = evaluarObligacionPT({
      patrimonioBrutoAnterior: patrimonio,
      ingresosBrutosActual: 0,
      uvtAnterior: UVT_2024,
      uvtActual: UVT_2025,
    });
    expect(r.patrimonioSupera).toBe(true);
    expect(r.obligado).toBe(true);
  });

  it("calcula umbrales correctamente", () => {
    const r = evaluarObligacionPT({
      patrimonioBrutoAnterior: 0,
      ingresosBrutosActual: 0,
      uvtAnterior: UVT_2024,
      uvtActual: UVT_2025,
    });
    expect(r.patrimonioUmbral).toBe(100_000 * UVT_2024);
    expect(r.ingresosUmbral).toBe(61_000 * UVT_2025);
  });
});
