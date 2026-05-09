import { describe, it, expect } from "vitest";
import {
  aplicaTTDPorRegimen,
  elegibleSobretasaFinanciera,
} from "./condicionales";

describe("aplicaTTDPorRegimen", () => {
  it("régimen general (01) → aplica TTD", () => {
    const r = aplicaTTDPorRegimen("01");
    expect(r.aplica).toBe(true);
    expect(r.razon).toBe(null);
  });

  it("cooperativa (02) → aplica TTD", () => {
    expect(aplicaTTDPorRegimen("02").aplica).toBe(true);
  });

  it("ZESE (03) → NO aplica TTD", () => {
    const r = aplicaTTDPorRegimen("03");
    expect(r.aplica).toBe(false);
    expect(r.razon).toMatch(/ZESE/);
  });

  it("Zona Franca Comercial (04) → NO aplica TTD", () => {
    const r = aplicaTTDPorRegimen("04");
    expect(r.aplica).toBe(false);
    expect(r.razon).toMatch(/Comercial/);
  });

  it("Zona Franca No Comercial (05) → NO aplica TTD", () => {
    expect(aplicaTTDPorRegimen("05").aplica).toBe(false);
  });

  it("Zona Franca Cúcuta (06) → NO aplica TTD", () => {
    expect(aplicaTTDPorRegimen("06").aplica).toBe(false);
  });

  it("Persona natural no residente (07) → NO aplica TTD", () => {
    expect(aplicaTTDPorRegimen("07").aplica).toBe(false);
  });

  it("ESAL (08) → NO aplica TTD", () => {
    const r = aplicaTTDPorRegimen("08");
    expect(r.aplica).toBe(false);
    expect(r.razon).toMatch(/ESAL/);
  });

  it("Tarifa 9% (09 al 12) → aplica TTD (default)", () => {
    // Estos sí aplican TTD según fuente. Los exoneraríamos sólo si el .xlsm
    // explícitamente los excluye, pero el comportamiento por defecto del
    // Liquidador es aplicar.
    expect(aplicaTTDPorRegimen("09").aplica).toBe(true);
    expect(aplicaTTDPorRegimen("12").aplica).toBe(true);
  });

  it("régimen sin código → aplica (default seguro)", () => {
    expect(aplicaTTDPorRegimen(null).aplica).toBe(true);
    expect(aplicaTTDPorRegimen(undefined).aplica).toBe(true);
    expect(aplicaTTDPorRegimen("").aplica).toBe(true);
  });

  it("acepta código sin padding (numérico)", () => {
    expect(aplicaTTDPorRegimen("3").aplica).toBe(false);
    expect(aplicaTTDPorRegimen("8").aplica).toBe(false);
  });
});

describe("elegibleSobretasaFinanciera", () => {
  it("régimen general (01) sí es elegible", () => {
    expect(elegibleSobretasaFinanciera("01")).toBe(true);
  });

  it("Zona Franca Comercial (04) sí es elegible (35%)", () => {
    expect(elegibleSobretasaFinanciera("04")).toBe(true);
  });

  it("ESAL (08) no es elegible (20%)", () => {
    expect(elegibleSobretasaFinanciera("08")).toBe(false);
  });

  it("ZESE (03) no es elegible (0%)", () => {
    expect(elegibleSobretasaFinanciera("03")).toBe(false);
  });
});
