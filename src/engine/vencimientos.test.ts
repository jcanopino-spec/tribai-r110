import { describe, it, expect } from "vitest";
import { ultimoDigitoNit, evaluarPresentacion } from "./vencimientos";

describe("ultimoDigitoNit", () => {
  it("extrae el último dígito de un NIT con guión", () => {
    expect(ultimoDigitoNit("900.123.456-7")).toBe(7);
    expect(ultimoDigitoNit("123456789-0")).toBe(0);
  });

  it("ignora caracteres no numéricos", () => {
    expect(ultimoDigitoNit("NIT 900-123-456 - 5")).toBe(5);
  });

  it("null/undefined/vacío → null", () => {
    expect(ultimoDigitoNit(null)).toBe(null);
    expect(ultimoDigitoNit(undefined)).toBe(null);
    expect(ultimoDigitoNit("")).toBe(null);
    expect(ultimoDigitoNit("---")).toBe(null);
  });
});

describe("evaluarPresentacion", () => {
  it("sin fecha de presentación → no_presentada", () => {
    const r = evaluarPresentacion("2026-04-15", null);
    expect(r.estado).toBe("no_presentada");
    expect(r.vencimiento).toBe("2026-04-15");
  });

  it("sin fecha de vencimiento → no_presentada", () => {
    const r = evaluarPresentacion(null, "2026-04-10");
    expect(r.estado).toBe("no_presentada");
  });

  it("presentación antes del vencimiento → oportuna", () => {
    const r = evaluarPresentacion("2026-04-15", "2026-04-10");
    expect(r.estado).toBe("oportuna");
    if (r.estado === "oportuna") {
      expect(r.diasDiferencia).toBe(-5);
      expect(r.mesesExtemporanea).toBe(0);
    }
  });

  it("presentación EL MISMO día del vencimiento → oportuna", () => {
    const r = evaluarPresentacion("2026-04-15", "2026-04-15");
    expect(r.estado).toBe("oportuna");
    if (r.estado === "oportuna") {
      expect(r.diasDiferencia).toBe(0);
      expect(r.mesesExtemporanea).toBe(0);
    }
  });

  it("1 día tarde → 1 mes-fracción de extemporaneidad", () => {
    const r = evaluarPresentacion("2026-04-15", "2026-04-16");
    expect(r.estado).toBe("extemporanea");
    if (r.estado === "extemporanea") {
      expect(r.diasDiferencia).toBe(1);
      expect(r.mesesExtemporanea).toBe(1);
    }
  });

  it("30 días tarde = 1 mes; 31 días = 2 meses (mes/fracción)", () => {
    const r1 = evaluarPresentacion("2026-04-15", "2026-05-15"); // 30 días
    const r2 = evaluarPresentacion("2026-04-15", "2026-05-16"); // 31 días
    expect(r1.estado).toBe("extemporanea");
    expect(r2.estado).toBe("extemporanea");
    if (r1.estado === "extemporanea") expect(r1.mesesExtemporanea).toBe(1);
    if (r2.estado === "extemporanea") expect(r2.mesesExtemporanea).toBe(2);
  });

  it("90 días tarde = 3 meses", () => {
    const r = evaluarPresentacion("2026-04-15", "2026-07-14");
    if (r.estado === "extemporanea") {
      expect(r.diasDiferencia).toBe(90);
      expect(r.mesesExtemporanea).toBe(3);
    }
  });
});
