import { describe, it, expect } from "vitest";
import { validarCuadresF110, TOLERANCIA_CUADRE } from "./validaciones";

function mkMap(input: Record<number, number>): Map<number, number> {
  return new Map(Object.entries(input).map(([k, v]) => [Number(k), v]));
}

// Helper · busca por prefijo exacto "Vn · " o "Rn esperado"
const VN = (n: number) => (m: string) => m.startsWith(`V${n} ·`);
const RN_ESPERADO = (n: number) => (m: string) => m.startsWith(`R${n} esperado`);

describe("validarCuadresF110 · cruces internos del F110", () => {
  it("V7 · R46 mal calculado → error", () => {
    const v = validarCuadresF110(mkMap({ 44: 100_000_000, 45: 30_000_000, 46: 999_000_000 }));
    const v7 = v.find((x) => VN(7)(x.mensaje));
    expect(v7?.nivel).toBe("error");
  });

  it("V8 · R61 mal calculado → error", () => {
    const v = validarCuadresF110(mkMap({ 58: 1_000_000_000, 59: 50_000_000, 60: 100_000_000, 61: 0 }));
    const v8 = v.find((x) => VN(8)(x.mensaje));
    expect(v8?.nivel).toBe("error");
  });

  it("V9 · costos no suman → error", () => {
    const v = validarCuadresF110(
      mkMap({ 62: 100_000_000, 63: 200_000_000, 64: 50_000_000, 65: 30_000_000, 66: 20_000_000, 67: 999_000_000 }),
    );
    const v9 = v.find((x) => VN(9)(x.mensaje));
    expect(v9?.nivel).toBe("error");
  });

  it("V10 · retenciones no suman → error", () => {
    const v = validarCuadresF110(mkMap({ 105: 100_000_000, 106: 200_000_000, 107: 999_000_000 }));
    const v10 = v.find((x) => VN(10)(x.mensaje));
    expect(v10?.nivel).toBe("error");
  });

  it("V11 · R94 mal calculado → error", () => {
    const v = validarCuadresF110(mkMap({ 91: 1_000_000_000, 92: 100_000_000, 93: 200_000_000, 94: 999_000 }));
    const v11 = v.find((x) => VN(11)(x.mensaje));
    expect(v11?.nivel).toBe("error");
  });

  it("V12 · R79 = max(R75, R76) - R77 + R78", () => {
    const v = validarCuadresF110(mkMap({ 75: 100_000_000, 76: 50_000_000, 77: 20_000_000, 78: 10_000_000, 79: 90_000_000 }));
    expect(v.find((x) => VN(12)(x.mensaje))).toBeUndefined();
  });

  it("V12 · usa renta presuntiva si es mayor que la líquida", () => {
    const v = validarCuadresF110(mkMap({ 75: 50_000_000, 76: 100_000_000, 77: 20_000_000, 78: 10_000_000, 79: 90_000_000 }));
    expect(v.find((x) => VN(12)(x.mensaje))).toBeUndefined();
  });

  it("V14 · descuentos R93 superan 75% R84 → error fiscal", () => {
    const v = validarCuadresF110(mkMap({ 84: 1_000_000_000, 93: 800_000_000 }));
    const v14 = v.find((x) => VN(14)(x.mensaje));
    expect(v14?.nivel).toBe("error");
    expect(v14?.categoria).toBe("fiscal");
  });

  it("V14 · descuentos exactamente al tope → sin error", () => {
    const v = validarCuadresF110(mkMap({ 84: 1_000_000_000, 93: 750_000_000 }));
    expect(v.find((x) => VN(14)(x.mensaje))).toBeUndefined();
  });

  it("V18 · suma dividendos R49..R56 > R58 → warn", () => {
    const v = validarCuadresF110(mkMap({ 51: 500_000_000, 52: 300_000_000, 58: 100_000_000 }));
    const v18 = v.find((x) => VN(18)(x.mensaje));
    expect(v18?.nivel).toBe("warn");
  });
});

describe("validarCuadresF110 · cruces con anexos (ctx)", () => {
  it("V1 · rentas exentas anexo cuadra con R77 → sin hallazgo", () => {
    const v = validarCuadresF110(mkMap({ 77: 50_000_000 }), {
      totalRentasExentas: 50_000_000,
    });
    expect(v.find((x) => VN(1)(x.mensaje))).toBeUndefined();
  });

  it("V1 · rentas exentas no cuadran → warn", () => {
    const v = validarCuadresF110(mkMap({ 77: 50_000_000 }), {
      totalRentasExentas: 60_000_000,
    });
    const v1 = v.find((x) => VN(1)(x.mensaje));
    expect(v1?.nivel).toBe("warn");
  });

  it("V2 · retenciones anexo cuadra con R107", () => {
    const v = validarCuadresF110(mkMap({ 107: 100_000_000, 105: 30_000_000, 106: 70_000_000 }), {
      totalAutorretenciones: 30_000_000,
      totalRetenciones: 70_000_000,
    });
    expect(v.find((x) => VN(2)(x.mensaje))).toBeUndefined();
  });

  it("V16 · compensación supera saldo de pérdidas → error", () => {
    const v = validarCuadresF110(mkMap({ 74: 100_000_000 }), {
      perdidasAcumuladas: 50_000_000,
    });
    const v16 = v.find((x) => VN(16)(x.mensaje));
    expect(v16?.nivel).toBe("error");
  });
});

describe("validarCuadresF110 · cruces de cierre (R91, R96, R99)", () => {
  it("R91 = suma R84..R90 cuadra → sin hallazgo", () => {
    const v = validarCuadresF110(
      mkMap({ 84: 1000, 85: 50, 86: 200, 87: 0, 88: 30, 89: 70, 90: 0, 91: 1350 }),
    );
    expect(v.find((x) => RN_ESPERADO(91)(x.mensaje))).toBeUndefined();
  });

  it("R91 inconsistente → error", () => {
    const v = validarCuadresF110(
      mkMap({ 84: 1_000_000_000, 85: 50_000_000, 91: 999 }),
    );
    const e = v.find((x) => RN_ESPERADO(91)(x.mensaje));
    expect(e?.nivel).toBe("error");
  });

  it("R96 = R94 + R95 cuadra", () => {
    const v = validarCuadresF110(mkMap({ 94: 100, 95: 20, 96: 120 }));
    expect(v.find((x) => RN_ESPERADO(96)(x.mensaje))).toBeUndefined();
  });

  it("R99 = max(0, R96 + R97 - R98) cuadra", () => {
    const v = validarCuadresF110(mkMap({ 96: 100, 97: 30, 98: 10, 99: 120 }));
    expect(v.find((x) => RN_ESPERADO(99)(x.mensaje))).toBeUndefined();
  });
});

describe("validarCuadresF110 · tolerancia DIAN", () => {
  it("descuadre ≤ TOLERANCIA_CUADRE no genera hallazgo", () => {
    const v = validarCuadresF110(
      mkMap({ 44: 100_000_000, 45: 30_000_000, 46: 70_000_500 }), // dif 500 < 1000
    );
    expect(v.find((x) => VN(7)(x.mensaje))).toBeUndefined();
  });

  it("descuadre > TOLERANCIA → error", () => {
    const v = validarCuadresF110(
      mkMap({ 44: 100_000_000, 45: 30_000_000, 46: 70_002_000 }), // dif 2000 > 1000
    );
    expect(v.find((x) => VN(7)(x.mensaje))).toBeDefined();
  });

  it("TOLERANCIA_CUADRE = 1000 (múltiplo DIAN)", () => {
    expect(TOLERANCIA_CUADRE).toBe(1000);
  });
});
