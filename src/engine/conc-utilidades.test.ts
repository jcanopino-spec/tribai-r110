import { describe, it, expect } from "vitest";
import {
  computarConcUtilidades,
  sumarCategoria,
  valorConSigno,
  type ConcUtilidadesInput,
  type PartidaConc,
} from "./conc-utilidades";

const baseContables = {
  ingOperacionales41: 1_000_000_000,
  ingNoOperacionales42: 50_000_000,
  devoluciones4175: 20_000_000,
  costoVenta6: 500_000_000,
  gastosAdmin51: 100_000_000,
  gastosVentas52: 80_000_000,
  gastosNoOper53: 30_000_000,
  gastosOtros54: 10_000_000,
};

function makeInput(
  partidas: PartidaConc[] = [],
  utilidad = 310_000_000,
  valoresF110: [number, number][] = [],
): ConcUtilidadesInput {
  return {
    utilidadContableNeta: utilidad,
    contables: baseContables,
    valoresF110: new Map(valoresF110),
    partidas,
  };
}

describe("computarConcUtilidades · estructura PyG", () => {
  it("genera 11 filas (8 conceptos + 2 totales + utilidad)", () => {
    const r = computarConcUtilidades(makeInput());
    expect(r.filasPyG.length).toBe(11);
    expect(r.filasPyG[0].concepto).toMatch(/Ingresos operacionales/);
    expect(r.filasPyG[3].esTotal).toBe(true);
    expect(r.filasPyG[3].concepto).toBe("TOTAL INGRESOS");
    expect(r.filasPyG[10].concepto).toBe("UTILIDAD ANTES DE IMPUESTOS");
  });

  it("contables del PyG vienen de los SUMIFs por prefijo", () => {
    const r = computarConcUtilidades(makeInput());
    const ingOper = r.filasPyG.find((f) => f.id === "ing_oper");
    expect(ingOper?.contable).toBe(1_000_000_000);
    const totalIng = r.filasPyG.find((f) => f.id === "total_ing");
    expect(totalIng?.contable).toBe(1_000_000_000 + 50_000_000 - 20_000_000);
  });

  it("fiscales del PyG vienen del F110", () => {
    const r = computarConcUtilidades(
      makeInput([], 0, [
        [47, 900_000_000],
        [48, 30_000_000],
        [57, 5_000_000],
        [59, 15_000_000],
      ]),
    );
    const ingOper = r.filasPyG.find((f) => f.id === "ing_oper");
    expect(ingOper?.fiscal).toBe(900_000_000);
    const ingNoOper = r.filasPyG.find((f) => f.id === "ing_no_oper");
    expect(ingNoOper?.fiscal).toBe(35_000_000); // R48 + R57
  });
});

describe("computarConcUtilidades · partidas y subtotales", () => {
  it("clasifica partidas por categoría NIC 12", () => {
    const partidas: PartidaConc[] = [
      { id: "p1", origen: "auto", categoria: "permanente", signo: "mas", concepto: "GMF 50%", valor: 5_000_000 },
      { id: "p2", origen: "auto", categoria: "permanente", signo: "menos", concepto: "INCRNGO", valor: 10_000_000 },
      { id: "p3", origen: "auto", categoria: "temporaria_deducible", signo: "mas", concepto: "Deterioro", valor: 8_000_000 },
      { id: "p4", origen: "auto", categoria: "temporaria_imponible", signo: "mas", concepto: "Dif cambio activo", valor: 3_000_000 },
    ];
    const r = computarConcUtilidades(makeInput(partidas));
    expect(r.subtotales.permanentes).toBe(5_000_000 - 10_000_000);
    expect(r.subtotales.temporariasDeducibles).toBe(8_000_000);
    expect(r.subtotales.temporariasImponibles).toBe(3_000_000);
    // netoTotal = ΔTempDed − ΔTempImp + Permanentes
    expect(r.subtotales.netoTotal).toBe(8_000_000 - 3_000_000 + (5_000_000 - 10_000_000));
  });

  it("partidas con signo 'menos' restan al subtotal de su categoría", () => {
    const partidas: PartidaConc[] = [
      { id: "p1", origen: "auto", categoria: "temporaria_deducible", signo: "menos", concepto: "Reverso", valor: 4_000_000 },
    ];
    const r = computarConcUtilidades(makeInput(partidas));
    expect(r.subtotales.temporariasDeducibles).toBe(-4_000_000);
  });
});

describe("computarConcUtilidades · cuadre y estado", () => {
  it("rentaLiquidaCalculada = utilidad + netoTotal", () => {
    const partidas: PartidaConc[] = [
      { id: "p1", origen: "manual", categoria: "permanente", signo: "mas", concepto: "Multas", valor: 2_000_000 },
    ];
    const r = computarConcUtilidades(makeInput(partidas, 100_000_000));
    expect(r.rentaLiquidaCalculada).toBe(102_000_000);
  });

  it("estado = 'cuadrado' si calculada matchea R72 (tolerancia 1)", () => {
    const r = computarConcUtilidades(
      makeInput([], 100_000_000, [[72, 100_000_000]]),
    );
    expect(r.cuadres.vsR72.ok).toBe(true);
    expect(r.estado).toBe("cuadrado");
  });

  it("estado = 'descuadrado' si la diferencia supera tolerancia escalada", () => {
    const r = computarConcUtilidades(
      makeInput([], 100_000_000, [[72, 50_000_000]]),
    );
    expect(r.cuadres.vsR72.ok).toBe(false);
    expect(r.estado).toBe("descuadrado");
  });

  it("expone los 3 cuadres (vs R72, R75, R79)", () => {
    const r = computarConcUtilidades(
      makeInput([], 100_000_000, [
        [72, 100_000_000],
        [75, 95_000_000],
        [79, 85_000_000],
      ]),
    );
    expect(r.cuadres.vsR72.real).toBe(100_000_000);
    expect(r.cuadres.vsR75.real).toBe(95_000_000);
    expect(r.cuadres.vsR79.real).toBe(85_000_000);
  });
});

describe("Helpers", () => {
  it("valorConSigno aplica signo correcto", () => {
    expect(valorConSigno({ id: "x", origen: "auto", categoria: "permanente", signo: "mas", concepto: "x", valor: 100 })).toBe(100);
    expect(valorConSigno({ id: "x", origen: "auto", categoria: "permanente", signo: "menos", concepto: "x", valor: 100 })).toBe(-100);
  });

  it("sumarCategoria filtra y suma con signo", () => {
    const ps: PartidaConc[] = [
      { id: "1", origen: "auto", categoria: "permanente", signo: "mas", concepto: "a", valor: 10 },
      { id: "2", origen: "auto", categoria: "permanente", signo: "menos", concepto: "b", valor: 3 },
      { id: "3", origen: "auto", categoria: "temporaria_deducible", signo: "mas", concepto: "c", valor: 5 },
    ];
    expect(sumarCategoria(ps, "permanente")).toBe(7);
    expect(sumarCategoria(ps, "temporaria_deducible")).toBe(5);
    expect(sumarCategoria(ps, "temporaria_imponible")).toBe(0);
  });
});
