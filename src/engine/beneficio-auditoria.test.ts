import { describe, it, expect } from "vitest";
import { evaluarBeneficioAuditoria } from "./beneficio-auditoria";

describe("evaluarBeneficioAuditoria", () => {
  it("no pidió beneficio → firmeza ordinaria 36 meses", () => {
    const r = evaluarBeneficioAuditoria({
      impuestoNetoActual: 100_000_000,
      impuestoNetoAnterior: 50_000_000,
      pidio12m: false,
      pidio6m: false,
      presentacionOportuna: true,
    });
    expect(r.mesesFirmeza).toBe(36);
    expect(r.cumpleRequisitos).toBe(true);
    expect(r.razon).toBe(null);
  });

  it("pidió beneficio pero impuesto AG anterior = 0 → no aplica", () => {
    const r = evaluarBeneficioAuditoria({
      impuestoNetoActual: 100_000_000,
      impuestoNetoAnterior: 0,
      pidio12m: true,
      pidio6m: false,
      presentacionOportuna: true,
    });
    expect(r.mesesFirmeza).toBe(36);
    expect(r.cumpleRequisitos).toBe(false);
    expect(r.razon).toMatch(/anterior es cero/);
  });

  it("presentación extemporánea → no aplica beneficio", () => {
    const r = evaluarBeneficioAuditoria({
      impuestoNetoActual: 200_000_000,
      impuestoNetoAnterior: 100_000_000,
      pidio12m: true,
      pidio6m: false,
      presentacionOportuna: false,
    });
    expect(r.mesesFirmeza).toBe(36);
    expect(r.cumpleRequisitos).toBe(false);
    expect(r.razon).toMatch(/oportunamente/);
  });

  it("pidió 12m + incremento ≥ 25% → 12 meses", () => {
    const r = evaluarBeneficioAuditoria({
      impuestoNetoActual: 130_000_000, // +30%
      impuestoNetoAnterior: 100_000_000,
      pidio12m: true,
      pidio6m: false,
      presentacionOportuna: true,
    });
    expect(r.mesesFirmeza).toBe(12);
    expect(r.cumpleRequisitos).toBe(true);
    expect(r.incremento).toBeCloseTo(0.3, 5);
  });

  it("pidió 12m + incremento exactamente 25% → 12 meses", () => {
    const r = evaluarBeneficioAuditoria({
      impuestoNetoActual: 125_000_000,
      impuestoNetoAnterior: 100_000_000,
      pidio12m: true,
      pidio6m: false,
      presentacionOportuna: true,
    });
    expect(r.mesesFirmeza).toBe(12);
    expect(r.cumpleRequisitos).toBe(true);
  });

  it("pidió 12m + incremento < 25% → no cumple", () => {
    const r = evaluarBeneficioAuditoria({
      impuestoNetoActual: 120_000_000, // +20%
      impuestoNetoAnterior: 100_000_000,
      pidio12m: true,
      pidio6m: false,
      presentacionOportuna: true,
    });
    expect(r.mesesFirmeza).toBe(36);
    expect(r.cumpleRequisitos).toBe(false);
    expect(r.razon).toMatch(/menor al 25%/);
  });

  it("pidió 6m + incremento ≥ 35% → 6 meses", () => {
    const r = evaluarBeneficioAuditoria({
      impuestoNetoActual: 140_000_000, // +40%
      impuestoNetoAnterior: 100_000_000,
      pidio12m: false,
      pidio6m: true,
      presentacionOportuna: true,
    });
    expect(r.mesesFirmeza).toBe(6);
    expect(r.cumpleRequisitos).toBe(true);
  });

  it("pidió 6m PERO solo logra 25% (sin pidio12m) → no cumple", () => {
    const r = evaluarBeneficioAuditoria({
      impuestoNetoActual: 130_000_000, // +30%
      impuestoNetoAnterior: 100_000_000,
      pidio12m: false,
      pidio6m: true,
      presentacionOportuna: true,
    });
    expect(r.mesesFirmeza).toBe(36);
    expect(r.cumpleRequisitos).toBe(false);
    expect(r.razon).toMatch(/35%/);
  });

  it("pidió 12m+6m, no alcanza 35% pero sí 25% → cae a 12m", () => {
    const r = evaluarBeneficioAuditoria({
      impuestoNetoActual: 130_000_000, // +30%
      impuestoNetoAnterior: 100_000_000,
      pidio12m: true,
      pidio6m: true,
      presentacionOportuna: true,
    });
    expect(r.mesesFirmeza).toBe(12);
    expect(r.cumpleRequisitos).toBe(true);
  });
});
