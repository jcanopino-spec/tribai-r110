import { describe, it, expect } from "vitest";
import {
  TASA_MINIMA,
  calcularTasaMinima,
  calcularImpuestoAdicionar,
} from "./tasa-minima";

const baseInputs = {
  inr: 0,
  vaa: 0,
  descuentosTributarios: 0,
  utilidadContable: 0,
  difPermanentesAumentan: 0,
  incrngo: 0,
  gananciaOcasionalGravable: 0,
  rentasExentas: 0,
  compensaciones: 0,
};

describe("calcularTasaMinima", () => {
  it("aplica=false → todo en 0", () => {
    const r = calcularTasaMinima({
      ...baseInputs,
      utilidadContable: 1_000_000_000,
      inr: 100_000_000,
      aplica: false,
    });
    expect(r).toEqual({ id: 0, ud: 0, ttd: null, ia: 0 });
  });

  it("UD ≤ 0 → IA = 0 sin importar el ID", () => {
    // utilidad 10M pero compensaciones 30M → UD = max(0, 10 - 30) = 0
    const r = calcularTasaMinima({
      ...baseInputs,
      utilidadContable: 10_000_000,
      compensaciones: 30_000_000,
      inr: 5_000_000,
      aplica: true,
    });
    expect(r.ud).toBe(0);
    expect(r.ttd).toBe(null);
    expect(r.ia).toBe(0);
  });

  it("TTD ≥ 15% → IA = 0 (la empresa cumple el mínimo)", () => {
    // UD = 100M, ID = 20M → TTD = 20% > 15%
    const r = calcularTasaMinima({
      ...baseInputs,
      utilidadContable: 100_000_000,
      inr: 20_000_000,
      aplica: true,
    });
    expect(r.ud).toBe(100_000_000);
    expect(r.id).toBe(20_000_000);
    expect(r.ttd).toBe(0.2);
    expect(r.ia).toBe(0);
  });

  it("TTD = 15% exacto → IA = 0", () => {
    const r = calcularTasaMinima({
      ...baseInputs,
      utilidadContable: 100_000_000,
      inr: 15_000_000,
      aplica: true,
    });
    expect(r.ttd).toBe(0.15);
    expect(r.ia).toBe(0);
  });

  it("TTD < 15% → IA = UD × 15% − ID", () => {
    // UD = 100M, ID = 10M (TTD = 10%) → IA = 100M × 15% − 10M = 5M
    const r = calcularTasaMinima({
      ...baseInputs,
      utilidadContable: 100_000_000,
      inr: 10_000_000,
      aplica: true,
    });
    expect(r.ud).toBe(100_000_000);
    expect(r.id).toBe(10_000_000);
    expect(r.ttd).toBeCloseTo(0.1, 5);
    expect(r.ia).toBe(5_000_000);
  });

  it("ID forzado ≥ 0 cuando IRP > INR + DTC", () => {
    const r = calcularTasaMinima({
      ...baseInputs,
      utilidadContable: 100_000_000,
      inr: 5_000_000,
      vaa: 0,
      descuentosTributarios: 0,
      impuestoRentasPasivas: 50_000_000,
      aplica: true,
    });
    expect(r.id).toBe(0);
  });

  it("DPARL aumenta UD; INCRNGO la reduce; RE/C la reducen", () => {
    // UC=80M, DPARL=20M, INCRNGO=10M, GO=5M, RE=5M, C=10M
    // UD = max(0, 80 + 20 − 10 − 0 − 5 − 5 − 10) = 70M
    const r = calcularTasaMinima({
      ...baseInputs,
      utilidadContable: 80_000_000,
      difPermanentesAumentan: 20_000_000,
      incrngo: 10_000_000,
      gananciaOcasionalGravable: 5_000_000,
      rentasExentas: 5_000_000,
      compensaciones: 10_000_000,
      inr: 9_000_000,
      aplica: true,
    });
    expect(r.ud).toBe(70_000_000);
    // TTD = 9M / 70M ≈ 0.1286 < 15% → IA = 70M × 15% − 9M = 1.5M
    expect(r.ia).toBe(1_500_000);
  });

  it("calcularImpuestoAdicionar es atajo solo del IA", () => {
    const args = {
      ...baseInputs,
      utilidadContable: 100_000_000,
      inr: 10_000_000,
      aplica: true,
    };
    expect(calcularImpuestoAdicionar(args)).toBe(calcularTasaMinima(args).ia);
  });

  it("constante TASA_MINIMA = 0.15", () => {
    expect(TASA_MINIMA).toBe(0.15);
  });

  it("vimpp por defecto = 0 si no se provee", () => {
    const a = calcularTasaMinima({
      ...baseInputs,
      utilidadContable: 100_000_000,
      inr: 10_000_000,
      aplica: true,
    });
    const b = calcularTasaMinima({
      ...baseInputs,
      utilidadContable: 100_000_000,
      inr: 10_000_000,
      vimpp: 0,
      aplica: true,
    });
    expect(a).toEqual(b);
  });

  it("VAA y descuentos suben el ID", () => {
    // INR=5M, VAA=3M, DT=2M → ID = 10M
    const r = calcularTasaMinima({
      ...baseInputs,
      utilidadContable: 100_000_000,
      inr: 5_000_000,
      vaa: 3_000_000,
      descuentosTributarios: 2_000_000,
      aplica: true,
    });
    expect(r.id).toBe(10_000_000);
  });
});
