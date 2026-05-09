import { describe, it, expect } from "vitest";
import { validarF2516, TOLERANCIA_CUADRE } from "./validaciones";
import { F2516_FILAS } from "./f2516";

const filaPorId = (id: string) => F2516_FILAS.find((f) => f.id === id)!;

function fila(args: {
  id: string;
  contable?: number;
  fiscal?: number;
  r110?: number | null;
  diferencia?: number | null;
}) {
  return {
    fila: filaPorId(args.id),
    contable: args.contable ?? 0,
    fiscal: args.fiscal ?? 0,
    r110: args.r110 ?? null,
    diferencia: args.diferencia ?? null,
  };
}

describe("validarF2516", () => {
  it("balance vacío → info 'sube el balance'", () => {
    const filas = F2516_FILAS.map((f) => ({
      fila: f,
      contable: 0,
      fiscal: 0,
      r110: null,
      diferencia: null,
    }));
    const r = validarF2516(filas);
    expect(r.length).toBe(1);
    expect(r[0].nivel).toBe("info");
    expect(r[0].mensaje).toMatch(/balance/i);
  });

  it("descuadre menor a tolerancia · sin hallazgo", () => {
    const filas = [
      fila({ id: "ESF_09_TOTAL_ACT", contable: 100_000_000, fiscal: 100_000_500, r110: 100_000_000, diferencia: 500 }),
    ];
    const r = validarF2516(filas);
    expect(r.length).toBe(0);
  });

  it("descuadre exacto en tolerancia · sin hallazgo", () => {
    const filas = [
      fila({ id: "ESF_10_PASIVOS", contable: 50_000_000, fiscal: 50_001_000, r110: 50_000_000, diferencia: TOLERANCIA_CUADRE }),
    ];
    expect(validarF2516(filas).length).toBe(0);
  });

  it("descuadre TOTAL ACTIVOS > tolerancia · ERROR", () => {
    const filas = [
      fila({
        id: "ESF_09_TOTAL_ACT",
        contable: 100_000_000,
        fiscal: 100_000_000,
        r110: 95_000_000,
        diferencia: 5_000_000,
      }),
    ];
    const r = validarF2516(filas);
    expect(r.length).toBe(1);
    expect(r[0].nivel).toBe("error");
    expect(r[0].categoria).toBe("f2516");
    expect(r[0].renglon).toBe(44);
  });

  it("descuadre R45 pasivos · ERROR (estructural)", () => {
    const filas = [
      fila({ id: "ESF_10_PASIVOS", contable: 30_000_000, fiscal: 30_000_000, r110: 25_000_000, diferencia: 5_000_000 }),
    ];
    const r = validarF2516(filas);
    expect(r[0].nivel).toBe("error");
  });

  it("descuadre R46 patrimonio líquido · ERROR (estructural)", () => {
    const filas = [
      fila({ id: "PAT_11_LIQUIDO", contable: 70_000_000, fiscal: 70_000_000, r110: 65_000_000, diferencia: 5_000_000 }),
    ];
    const r = validarF2516(filas);
    expect(r[0].nivel).toBe("error");
  });

  it("descuadre individual R58 ingresos · WARN (no estructural)", () => {
    const filas = [
      fila({ id: "ERI_12_INGRESOS", contable: 1_000_000_000, fiscal: 1_000_000_000, r110: 990_000_000, diferencia: 10_000_000 }),
    ];
    const r = validarF2516(filas);
    expect(r[0].nivel).toBe("warn");
    expect(r[0].renglon).toBe(58);
    expect(r[0].mensaje).toMatch(/conciliaciones\/formato-2516/);
  });

  it("varios descuadres → varios hallazgos", () => {
    const filas = [
      fila({ id: "ESF_09_TOTAL_ACT", contable: 100_000_000, fiscal: 100_000_000, r110: 90_000_000, diferencia: 10_000_000 }),
      fila({ id: "ERI_12_INGRESOS", contable: 1_000_000_000, fiscal: 1_000_000_000, r110: 980_000_000, diferencia: 20_000_000 }),
    ];
    expect(validarF2516(filas).length).toBe(2);
  });

  it("filas sin r110 (ESF activos individuales) · ignoradas", () => {
    const filas = [
      fila({ id: "ESF_01_EFECTIVO", contable: 50_000_000, fiscal: 60_000_000, r110: null, diferencia: null }),
    ];
    expect(validarF2516(filas).length).toBe(0);
  });

  it("balance NO vacío + cuadre OK · sin hallazgos", () => {
    const filas = F2516_FILAS.map((f) => fila({
      id: f.id,
      contable: 1_000_000,
      fiscal: 1_000_000,
      r110: f.cuadraConR110 ? 1_000_000 : null,
      diferencia: f.cuadraConR110 ? 0 : null,
    }));
    expect(validarF2516(filas).length).toBe(0);
  });
});
