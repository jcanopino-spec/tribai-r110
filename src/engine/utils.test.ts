import { describe, it, expect } from "vitest";
import {
  RENGLONES_POSITIVOS,
  normalizarSigno,
  sumRango,
  redondearDIAN,
} from "./utils";

describe("normalizarSigno", () => {
  it("fuerza positivo en pasivos (R45)", () => {
    expect(normalizarSigno(45, -1_500_000)).toBe(1_500_000);
    expect(normalizarSigno(45, 1_500_000)).toBe(1_500_000);
  });

  it("fuerza positivo en ingresos (R47..R57)", () => {
    expect(normalizarSigno(47, -3_000_000)).toBe(3_000_000);
    expect(normalizarSigno(57, -10)).toBe(10);
  });

  it("fuerza positivo en costos (R62..R66)", () => {
    expect(normalizarSigno(62, -800_000)).toBe(800_000);
    expect(normalizarSigno(66, -200_000)).toBe(200_000);
  });

  it("fuerza positivo en INCRNGO (R59, R60)", () => {
    expect(normalizarSigno(59, -100)).toBe(100);
    expect(normalizarSigno(60, -200)).toBe(200);
  });

  it("respeta signo en renglones que admiten negativo", () => {
    expect(normalizarSigno(36, -100)).toBe(-100);
    expect(normalizarSigno(99, -1)).toBe(-1);
    expect(normalizarSigno(111, -50)).toBe(-50);
  });

  it("RENGLONES_POSITIVOS incluye los rangos esperados", () => {
    expect(RENGLONES_POSITIVOS.has(45)).toBe(true);
    expect(RENGLONES_POSITIVOS.has(50)).toBe(true);
    expect(RENGLONES_POSITIVOS.has(64)).toBe(true);
    expect(RENGLONES_POSITIVOS.has(36)).toBe(false);
    expect(RENGLONES_POSITIVOS.has(70)).toBe(false);
  });
});

describe("sumRango", () => {
  it("suma rango cerrado [from, to]", () => {
    const m = new Map<number, number>([
      [36, 100],
      [37, 200],
      [38, 300],
      [39, 400],
    ]);
    expect(sumRango(m, 36, 39)).toBe(1000);
    expect(sumRango(m, 37, 38)).toBe(500);
  });

  it("trata renglones ausentes como 0", () => {
    const m = new Map<number, number>([[40, 500]]);
    expect(sumRango(m, 36, 43)).toBe(500);
  });

  it("rango vacío devuelve 0", () => {
    expect(sumRango(new Map(), 47, 57)).toBe(0);
  });

  it("from > to devuelve 0", () => {
    const m = new Map<number, number>([[50, 999]]);
    expect(sumRango(m, 60, 50)).toBe(0);
  });
});

describe("redondearDIAN", () => {
  it("redondea al múltiplo de 1.000 más cercano", () => {
    expect(redondearDIAN(1_499)).toBe(1_000);
    expect(redondearDIAN(1_500)).toBe(2_000);
    expect(redondearDIAN(1_501)).toBe(2_000);
    expect(redondearDIAN(123_456)).toBe(123_000);
    expect(redondearDIAN(123_500)).toBe(124_000);
  });

  it("preserva ceros y exactos múltiplos", () => {
    expect(redondearDIAN(0)).toBe(0);
    expect(redondearDIAN(5_000)).toBe(5_000);
    expect(redondearDIAN(1_000_000)).toBe(1_000_000);
  });

  it("redondea valores negativos correctamente", () => {
    expect(redondearDIAN(-1_499)).toBe(-1_000);
    expect(redondearDIAN(-1_500)).toBe(-1_000);
    expect(redondearDIAN(-1_501)).toBe(-2_000);
  });
});
