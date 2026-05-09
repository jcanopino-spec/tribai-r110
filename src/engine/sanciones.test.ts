import { describe, it, expect } from "vitest";
import {
  SANCION_MINIMA_UVT,
  calcularSancionExtemporaneidad,
  calcularSancionCorreccion,
} from "./sanciones";

// UVT 2026 oficial DIAN para los ejemplos. Mantengo un valor fijo para
// que los tests no dependan del año.
const UVT = 49_799;
const MINIMA = SANCION_MINIMA_UVT * UVT; // 497.990

describe("calcularSancionExtemporaneidad · Art. 641 (sin emplazamiento)", () => {
  it("0 cuando meses ≤ 0", () => {
    expect(
      calcularSancionExtemporaneidad({
        meses: 0,
        impuestoCargo: 50_000_000,
        ingresosBrutos: 0,
        patrimonioLiquidoAnterior: 0,
        uvt: UVT,
        existeEmplazamiento: false,
        reduccion: "0",
      }),
    ).toBe(0);
  });

  it("5% por mes sobre el impuesto a cargo, tope 100%", () => {
    // 3 meses · 5% · 50M = 7.5M (15%)
    const r = calcularSancionExtemporaneidad({
      meses: 3,
      impuestoCargo: 50_000_000,
      ingresosBrutos: 0,
      patrimonioLiquidoAnterior: 0,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "0",
    });
    expect(r).toBe(7_500_000);
  });

  it("topea al 100% del impuesto cuando los meses superan 20", () => {
    // 25 meses × 5% = 125% → topea a 100% del impuesto
    const r = calcularSancionExtemporaneidad({
      meses: 25,
      impuestoCargo: 10_000_000,
      ingresosBrutos: 0,
      patrimonioLiquidoAnterior: 0,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "0",
    });
    expect(r).toBe(10_000_000);
  });

  it("aplica sanción mínima 10 UVT cuando el cálculo es muy bajo", () => {
    // 1 mes × 5% × 100.000 = 5.000 → < mínima
    const r = calcularSancionExtemporaneidad({
      meses: 1,
      impuestoCargo: 100_000,
      ingresosBrutos: 0,
      patrimonioLiquidoAnterior: 0,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "0",
    });
    expect(r).toBe(MINIMA);
  });

  it("usa ingresos brutos cuando no hay impuesto a cargo (0.5%/mes, tope 5%)", () => {
    // 4 meses × 0.5% × 1.000M = 20M
    const r = calcularSancionExtemporaneidad({
      meses: 4,
      impuestoCargo: 0,
      ingresosBrutos: 1_000_000_000,
      patrimonioLiquidoAnterior: 0,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "0",
    });
    expect(r).toBe(20_000_000);
  });

  it("topea al 5% de ingresos cuando muchos meses", () => {
    // 20 meses × 0.5% = 10% → tope 5% = 50M
    const r = calcularSancionExtemporaneidad({
      meses: 20,
      impuestoCargo: 0,
      ingresosBrutos: 1_000_000_000,
      patrimonioLiquidoAnterior: 0,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "0",
    });
    expect(r).toBe(50_000_000);
  });

  it("usa patrimonio cuando no hay impuesto ni ingresos", () => {
    // 2 meses × 1% × 500M = 10M
    const r = calcularSancionExtemporaneidad({
      meses: 2,
      impuestoCargo: 0,
      ingresosBrutos: 0,
      patrimonioLiquidoAnterior: 500_000_000,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "0",
    });
    expect(r).toBe(10_000_000);
  });

  it("aplica reducción del 50% (Art. 640)", () => {
    // 3 meses × 5% × 50M = 7.5M, reducido al 50% = 3.75M
    const r = calcularSancionExtemporaneidad({
      meses: 3,
      impuestoCargo: 50_000_000,
      ingresosBrutos: 0,
      patrimonioLiquidoAnterior: 0,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "50",
    });
    expect(r).toBe(3_750_000);
  });

  it("aplica reducción del 75% pero respeta sanción mínima", () => {
    // base 7.5M × 25% = 1.875M (sigue ≥ mínima ~498k)
    const r = calcularSancionExtemporaneidad({
      meses: 3,
      impuestoCargo: 50_000_000,
      ingresosBrutos: 0,
      patrimonioLiquidoAnterior: 0,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "75",
    });
    expect(r).toBe(1_875_000);
  });
});

describe("calcularSancionExtemporaneidad · Art. 642 (con emplazamiento)", () => {
  it("10% por mes sobre impuesto a cargo, tope 200%", () => {
    // 5 meses × 10% × 20M = 10M (50%)
    const r = calcularSancionExtemporaneidad({
      meses: 5,
      impuestoCargo: 20_000_000,
      ingresosBrutos: 0,
      patrimonioLiquidoAnterior: 0,
      uvt: UVT,
      existeEmplazamiento: true,
      reduccion: "0",
    });
    expect(r).toBe(10_000_000);
  });

  it("topea al 200% del impuesto", () => {
    // 25 meses × 10% = 250% → topea 200%
    const r = calcularSancionExtemporaneidad({
      meses: 25,
      impuestoCargo: 10_000_000,
      ingresosBrutos: 0,
      patrimonioLiquidoAnterior: 0,
      uvt: UVT,
      existeEmplazamiento: true,
      reduccion: "0",
    });
    expect(r).toBe(20_000_000);
  });

  it("1% por mes sobre ingresos cuando no hay impuesto, tope 10%", () => {
    // 3 meses × 1% × 100M = 3M
    const r = calcularSancionExtemporaneidad({
      meses: 3,
      impuestoCargo: 0,
      ingresosBrutos: 100_000_000,
      patrimonioLiquidoAnterior: 0,
      uvt: UVT,
      existeEmplazamiento: true,
      reduccion: "0",
    });
    expect(r).toBe(3_000_000);
  });

  it("2% sobre patrimonio anterior, tope 20%", () => {
    // 5 meses × 2% × 100M = 10M
    const r = calcularSancionExtemporaneidad({
      meses: 5,
      impuestoCargo: 0,
      ingresosBrutos: 0,
      patrimonioLiquidoAnterior: 100_000_000,
      uvt: UVT,
      existeEmplazamiento: true,
      reduccion: "0",
    });
    expect(r).toBe(10_000_000);
  });
});

describe("calcularSancionCorreccion · Art. 644", () => {
  it("0 cuando mayor valor ≤ 0", () => {
    expect(
      calcularSancionCorreccion({
        mayorValor: 0,
        uvt: UVT,
        existeEmplazamiento: false,
        reduccion: "0",
      }),
    ).toBe(0);
    expect(
      calcularSancionCorreccion({
        mayorValor: -100_000,
        uvt: UVT,
        existeEmplazamiento: false,
        reduccion: "0",
      }),
    ).toBe(0);
  });

  it("10% del mayor valor sin emplazamiento", () => {
    const r = calcularSancionCorreccion({
      mayorValor: 50_000_000,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "0",
    });
    expect(r).toBe(5_000_000);
  });

  it("20% del mayor valor con emplazamiento", () => {
    const r = calcularSancionCorreccion({
      mayorValor: 50_000_000,
      uvt: UVT,
      existeEmplazamiento: true,
      reduccion: "0",
    });
    expect(r).toBe(10_000_000);
  });

  it("aplica reducción 50%", () => {
    const r = calcularSancionCorreccion({
      mayorValor: 50_000_000,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "50",
    });
    expect(r).toBe(2_500_000);
  });

  it("respeta sanción mínima 10 UVT cuando el cálculo es muy bajo", () => {
    // 10% × 100k = 10k → < mínima
    const r = calcularSancionCorreccion({
      mayorValor: 100_000,
      uvt: UVT,
      existeEmplazamiento: false,
      reduccion: "0",
    });
    expect(r).toBe(MINIMA);
  });
});
