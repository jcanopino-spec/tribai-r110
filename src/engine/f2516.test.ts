import { describe, it, expect } from "vitest";
import {
  F2516_FILAS,
  categorizarPucF2516,
  calcularFiscal,
} from "./f2516";

describe("F2516_FILAS · estructura", () => {
  it("tiene exactamente 18 filas", () => {
    expect(F2516_FILAS.length).toBe(18);
  });

  it("numera del 1 al 18 sin saltos", () => {
    const numeros = F2516_FILAS.map((f) => f.numero);
    expect(numeros).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it("totales (esTotal=true) cuadran con renglones del F110", () => {
    const totales = F2516_FILAS.filter((f) => f.esTotal);
    expect(totales.length).toBeGreaterThan(0);
    for (const t of totales) {
      expect(t.cuadraConR110).toBeDefined();
    }
  });
});

describe("categorizarPucF2516 · prefijos PUC", () => {
  it("efectivo · 11xx", () => {
    expect(categorizarPucF2516("1105")).toBe("ESF_01_EFECTIVO");
    expect(categorizarPucF2516("1110")).toBe("ESF_01_EFECTIVO");
    expect(categorizarPucF2516("110505")).toBe("ESF_01_EFECTIVO");
  });

  it("inversiones · 12xx", () => {
    expect(categorizarPucF2516("1205")).toBe("ESF_02_INVERSIONES");
    expect(categorizarPucF2516("1295")).toBe("ESF_02_INVERSIONES");
  });

  it("cuentas por cobrar · 13xx", () => {
    expect(categorizarPucF2516("1305")).toBe("ESF_03_CXC");
    expect(categorizarPucF2516("1325")).toBe("ESF_03_CXC");
    expect(categorizarPucF2516("1399")).toBe("ESF_03_CXC");
  });

  it("inventarios · 14xx", () => {
    expect(categorizarPucF2516("1405")).toBe("ESF_04_INVENT");
    expect(categorizarPucF2516("1430")).toBe("ESF_04_INVENT");
  });

  it("biológicos · 1567/1568/1569 (excepción dentro de clase 15)", () => {
    expect(categorizarPucF2516("1567")).toBe("ESF_06_BIO");
    expect(categorizarPucF2516("1568")).toBe("ESF_06_BIO");
    expect(categorizarPucF2516("1569")).toBe("ESF_06_BIO");
  });

  it("PPE · 15xx (resto)", () => {
    expect(categorizarPucF2516("1504")).toBe("ESF_07_PPE");
    expect(categorizarPucF2516("1516")).toBe("ESF_07_PPE");
    expect(categorizarPucF2516("1592")).toBe("ESF_07_PPE");
  });

  it("intangibles · 16xx", () => {
    expect(categorizarPucF2516("1605")).toBe("ESF_05_INTAN");
    expect(categorizarPucF2516("1635")).toBe("ESF_05_INTAN");
  });

  it("otros activos · 17/18/19", () => {
    expect(categorizarPucF2516("1705")).toBe("ESF_08_OTROS");
    expect(categorizarPucF2516("1805")).toBe("ESF_08_OTROS");
    expect(categorizarPucF2516("1905")).toBe("ESF_08_OTROS");
  });

  it("pasivos · clase 2 entera", () => {
    expect(categorizarPucF2516("2105")).toBe("ESF_10_PASIVOS");
    expect(categorizarPucF2516("2335")).toBe("ESF_10_PASIVOS");
    expect(categorizarPucF2516("2965")).toBe("ESF_10_PASIVOS");
  });

  it("patrimonio · clase 3 → null (se calcula como diferencia)", () => {
    expect(categorizarPucF2516("3105")).toBe(null);
    expect(categorizarPucF2516("3315")).toBe(null);
  });

  it("ingresos · clase 4 (excepto devoluciones)", () => {
    expect(categorizarPucF2516("4135")).toBe("ERI_12_INGRESOS");
    expect(categorizarPucF2516("4250")).toBe("ERI_12_INGRESOS");
  });

  it("devoluciones · 4175 / 4275 (excepción)", () => {
    expect(categorizarPucF2516("4175")).toBe("ERI_13_DEVOL");
    expect(categorizarPucF2516("4275")).toBe("ERI_13_DEVOL");
  });

  it("costos y gastos · clases 5/6/7", () => {
    expect(categorizarPucF2516("5105")).toBe("ERI_16_COSTOS"); // gastos op admon
    expect(categorizarPucF2516("6135")).toBe("ERI_16_COSTOS"); // costo de venta
    expect(categorizarPucF2516("7105")).toBe("ERI_16_COSTOS"); // costo producción
  });

  it("cuentas de orden · clases 8/9 → null", () => {
    expect(categorizarPucF2516("8105")).toBe(null);
    expect(categorizarPucF2516("9105")).toBe(null);
  });

  it("input null/undefined/vacío → null", () => {
    expect(categorizarPucF2516(null)).toBe(null);
    expect(categorizarPucF2516(undefined)).toBe(null);
    expect(categorizarPucF2516("")).toBe(null);
    expect(categorizarPucF2516("---")).toBe(null);
  });
});

describe("calcularFiscal", () => {
  it("Contable + Conversión − Menor + Mayor", () => {
    expect(
      calcularFiscal({ contable: 100, conversion: 10, menorFiscal: 20, mayorFiscal: 30 }),
    ).toBe(120); // 100 + 10 - 20 + 30
  });

  it("sin ajustes → fiscal = contable", () => {
    expect(
      calcularFiscal({ contable: 500, conversion: 0, menorFiscal: 0, mayorFiscal: 0 }),
    ).toBe(500);
  });

  it("solo menor fiscal reduce", () => {
    expect(
      calcularFiscal({ contable: 100, conversion: 0, menorFiscal: 50, mayorFiscal: 0 }),
    ).toBe(50);
  });

  it("solo mayor fiscal aumenta", () => {
    expect(
      calcularFiscal({ contable: 100, conversion: 0, menorFiscal: 0, mayorFiscal: 50 }),
    ).toBe(150);
  });
});
