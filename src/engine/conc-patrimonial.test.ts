import { describe, it, expect } from "vitest";
import {
  computarConcPatrimonial,
  clasificarBucket,
  type ConcPatrimonialInput,
  type PartidaManualPatrimonial,
} from "./conc-patrimonial";

function baseInput(over: Partial<ConcPatrimonialInput> = {}): ConcPatrimonialInput {
  return {
    patrimonioLiquidoActual: 1_000_000_000,
    rentaLiquidaEjercicio: 0,
    impuestoNetoRenta: 0,
    ingresosNoGravados: 0,
    gananciaOcasionalBruta: 0,
    impuestoNetoGO: 0,
    patrimonioLiquidoAnterior: 1_000_000_000,
    saldoPagarAnterior: 0,
    deduccionArt158_3: 0,
    gastosNoDeducidos: 0,
    partidasManuales: [],
    esPrimerAno: false,
    ...over,
  };
}

describe("computarConcPatrimonial · primer año (Art. 237)", () => {
  it("primer año no aplica · todo justificado", () => {
    const r = computarConcPatrimonial(
      baseInput({ esPrimerAno: true, patrimonioLiquidoActual: 5_000_000_000, patrimonioLiquidoAnterior: 0 }),
    );
    expect(r.estado).toBe("no_aplica");
    expect(r.rentaPorComparacion).toBe(0);
    expect(r.justificantes).toHaveLength(0);
  });
});

describe("computarConcPatrimonial · justificantes", () => {
  it("renta líquida − impuesto neto justifica el crecimiento", () => {
    const r = computarConcPatrimonial(
      baseInput({
        patrimonioLiquidoAnterior: 1_000_000_000,
        patrimonioLiquidoActual: 1_080_000_000,
        rentaLiquidaEjercicio: 100_000_000,
        impuestoNetoRenta: 20_000_000,
      }),
    );
    // Justifica 80M (=100-20). PL crece exactamente 80M → cuadra
    expect(r.totalJustificantes).toBe(80_000_000);
    expect(r.plJustificado).toBe(1_080_000_000);
    expect(r.cuadra).toBe(true);
    expect(r.rentaPorComparacion).toBe(0);
  });

  it("INCRNGO + GO neta de impuesto justifican adicionalmente", () => {
    const r = computarConcPatrimonial(
      baseInput({
        patrimonioLiquidoAnterior: 1_000_000_000,
        patrimonioLiquidoActual: 1_100_000_000,
        rentaLiquidaEjercicio: 50_000_000,
        impuestoNetoRenta: 10_000_000,
        ingresosNoGravados: 20_000_000,
        gananciaOcasionalBruta: 50_000_000,
        impuestoNetoGO: 7_500_000,
      }),
    );
    // 40 + 20 + 42.5 = 102.5M (sobrejustifica 2.5M · diferencia negativa)
    expect(r.totalJustificantes).toBe(40_000_000 + 20_000_000 + 42_500_000);
    expect(r.diferenciaPorJustificar).toBe(-2_500_000);
    expect(r.rentaPorComparacion).toBe(0);
    expect(r.cuadra).toBe(false); // |2.5M| > tolerancia 1
  });

  it("deducción Art. 158-3 suma al justificado", () => {
    const r = computarConcPatrimonial(
      baseInput({
        patrimonioLiquidoAnterior: 1_000_000_000,
        patrimonioLiquidoActual: 1_115_000_000,
        rentaLiquidaEjercicio: 100_000_000,
        impuestoNetoRenta: 35_000_000,
        deduccionArt158_3: 50_000_000,
      }),
    );
    // 65 + 50 = 115 justifica exactamente
    expect(r.justificantes.find((j) => j.id === "art_158_3")?.valor).toBe(50_000_000);
    expect(r.cuadra).toBe(true);
  });
});

describe("computarConcPatrimonial · restadores", () => {
  it("gastos NO deducidos en renta fiscal salen del patrimonio", () => {
    const r = computarConcPatrimonial(
      baseInput({
        patrimonioLiquidoAnterior: 1_000_000_000,
        patrimonioLiquidoActual: 970_000_000,
        rentaLiquidaEjercicio: 50_000_000,
        impuestoNetoRenta: 17_500_000,
        gastosNoDeducidos: 62_500_000,
      }),
    );
    // PL_just = 1000 + (50-17.5) - 62.5 = 970M ✓
    expect(r.totalRestadores).toBe(62_500_000);
    expect(r.cuadra).toBe(true);
  });

  it("saldo a pagar año anterior resta", () => {
    const r = computarConcPatrimonial(
      baseInput({
        patrimonioLiquidoAnterior: 1_000_000_000,
        patrimonioLiquidoActual: 935_000_000,
        rentaLiquidaEjercicio: 50_000_000,
        impuestoNetoRenta: 17_500_000,
        saldoPagarAnterior: 97_500_000,
      }),
    );
    // 1000 + 32.5 - 97.5 = 935M ✓
    expect(r.totalRestadores).toBe(97_500_000);
    expect(r.cuadra).toBe(true);
  });
});

describe("computarConcPatrimonial · renta presunta Art. 236", () => {
  it("crecimiento NO justificado se convierte en renta por comparación", () => {
    const r = computarConcPatrimonial(
      baseInput({
        patrimonioLiquidoAnterior: 1_000_000_000,
        patrimonioLiquidoActual: 1_500_000_000,
        rentaLiquidaEjercicio: 100_000_000,
        impuestoNetoRenta: 35_000_000,
      }),
    );
    // Justifica 65M, pero el patrimonio creció 500M
    // Diferencia 500 - 65 = 435M → renta presunta
    expect(r.totalJustificantes).toBe(65_000_000);
    expect(r.plJustificado).toBe(1_065_000_000);
    expect(r.diferenciaPorJustificar).toBe(435_000_000);
    expect(r.rentaPorComparacion).toBe(435_000_000);
    expect(r.estado).toBe("renta_presunta");
  });

  it("partidas manuales completan la justificación", () => {
    const partidasManuales: PartidaManualPatrimonial[] = [
      {
        id: 1,
        signo: "mas",
        concepto: "Valorización de inversiones",
        valor: 200_000_000,
        bucket: "valorizacion",
      },
      {
        id: 2,
        signo: "mas",
        concepto: "Normalización tributaria Ley 2010",
        valor: 100_000_000,
        bucket: "normalizacion",
      },
      {
        id: 3,
        signo: "menos",
        concepto: "Desvalorización de PP&E",
        valor: 50_000_000,
        bucket: "desvalorizacion",
      },
    ];
    const r = computarConcPatrimonial(
      baseInput({
        patrimonioLiquidoAnterior: 1_000_000_000,
        patrimonioLiquidoActual: 1_315_000_000,
        rentaLiquidaEjercicio: 100_000_000,
        impuestoNetoRenta: 35_000_000,
        partidasManuales,
      }),
    );
    // 65 + 200 + 100 - 50 = 315 → cuadra
    expect(r.totalJustificantes).toBe(65_000_000 + 200_000_000 + 100_000_000);
    expect(r.totalRestadores).toBe(50_000_000);
    expect(r.cuadra).toBe(true);
  });
});

describe("clasificarBucket · heurística por keyword", () => {
  it("detecta valorización / desvalorización / normalización", () => {
    expect(clasificarBucket("Valorización de inversiones", "mas")).toBe("valorizacion");
    expect(clasificarBucket("Desvalorización de PP&E", "menos")).toBe("desvalorizacion");
    expect(clasificarBucket("Normalización Art. 239-1", "mas")).toBe("normalizacion");
    expect(clasificarBucket("Otro concepto", "mas")).toBe("otra");
  });
});
