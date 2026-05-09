import { describe, it, expect } from "vitest";
import { validarFormulario, resumenValidaciones } from "./validaciones";

function mkMap(input: Record<number, number>): Map<number, number> {
  return new Map(Object.entries(input).map(([k, v]) => [Number(k), v]));
}

describe("validarFormulario · configuración", () => {
  it("sin tarifa de régimen → error de configuración", () => {
    const v = validarFormulario(mkMap({}), { tarifaRegimen: null });
    expect(v.some((x) => x.categoria === "configuracion" && x.nivel === "error")).toBe(true);
  });

  it("renta gravable + tarifa = 0 → error R84", () => {
    const v = validarFormulario(mkMap({ 79: 100_000_000 }), { tarifaRegimen: 0 });
    expect(v.some((x) => x.renglon === 84 && x.nivel === "error")).toBe(true);
  });
});

describe("validarFormulario · ESAL R68/R69", () => {
  it("régimen ordinario (01) + R68 > 0 → warn", () => {
    const v = validarFormulario(mkMap({ 68: 5_000_000 }), {
      tarifaRegimen: 0.35,
      regimenCodigo: "01",
    });
    expect(v.some((x) => x.renglon === 68 && x.nivel === "warn" && x.mensaje.includes("ESAL"))).toBe(true);
  });

  it("régimen ESAL (08) + R68/R69 > 0 → sin warn ESAL", () => {
    const v = validarFormulario(mkMap({ 68: 5_000_000, 69: 2_000_000 }), {
      tarifaRegimen: 0.20,
      regimenCodigo: "08",
    });
    expect(v.some((x) => x.mensaje.includes("ESAL"))).toBe(false);
  });

  it("régimen ordinario + R68/R69 = 0 → sin warn", () => {
    const v = validarFormulario(mkMap({ 68: 0, 69: 0 }), {
      tarifaRegimen: 0.35,
      regimenCodigo: "01",
    });
    expect(v.some((x) => x.mensaje.includes("ESAL"))).toBe(false);
  });
});

describe("validarFormulario · cuadre patrimonial", () => {
  it("R44 < R45 → warn (patrimonio líquido en 0)", () => {
    const v = validarFormulario(mkMap({ 44: 100, 45: 200 }), { tarifaRegimen: 0.35 });
    expect(v.some((x) => x.renglon === 46 && x.nivel === "warn")).toBe(true);
  });

  it("R44 = 0 y R45 = 0 → completitud warn", () => {
    const v = validarFormulario(mkMap({ 44: 0, 45: 0 }), { tarifaRegimen: 0.35 });
    expect(v.some((x) => x.renglon === 44 && x.categoria === "completitud")).toBe(true);
  });
});

describe("validarFormulario · cuadre operativo", () => {
  it("costos > ingresos → info pérdida", () => {
    const v = validarFormulario(mkMap({ 58: 100, 67: 200 }), { tarifaRegimen: 0.35 });
    expect(v.some((x) => x.renglon === 73 && x.categoria === "sanidad")).toBe(true);
  });

  it("hay pérdida líquida (R73>0) → info compensar", () => {
    const v = validarFormulario(mkMap({ 73: 50_000_000 }), { tarifaRegimen: 0.35 });
    expect(v.filter((x) => x.renglon === 73 && x.categoria === "fiscal").length).toBe(1);
  });

  it("compensaciones > renta líquida → warn", () => {
    const v = validarFormulario(mkMap({ 72: 10_000_000, 74: 50_000_000 }), { tarifaRegimen: 0.35 });
    expect(v.some((x) => x.renglon === 74 && x.nivel === "warn")).toBe(true);
  });

  it("rentas exentas > max(75, 76) → error", () => {
    const v = validarFormulario(mkMap({ 75: 100, 76: 50, 77: 200 }), { tarifaRegimen: 0.35 });
    expect(v.some((x) => x.renglon === 77 && x.nivel === "error")).toBe(true);
  });

  it("devoluciones > ingresos brutos → warn", () => {
    const v = validarFormulario(mkMap({ 58: 100, 59: 200 }), { tarifaRegimen: 0.35 });
    expect(v.some((x) => x.renglon === 59 && x.nivel === "warn")).toBe(true);
  });

  it("INCRNGO > ingresos brutos → warn", () => {
    const v = validarFormulario(mkMap({ 58: 100, 60: 200 }), { tarifaRegimen: 0.35 });
    expect(v.some((x) => x.renglon === 60 && x.nivel === "warn")).toBe(true);
  });
});

describe("validarFormulario · sin renta gravable", () => {
  it("R79=R76=R72=0 → info 'impuesto = 0'", () => {
    const v = validarFormulario(mkMap({}), { tarifaRegimen: 0.35 });
    expect(v.some((x) => x.renglon === 79 && x.categoria === "completitud")).toBe(true);
  });
});

describe("validarFormulario · descuentos tributarios", () => {
  it("R93 > R91+R92 → error", () => {
    const v = validarFormulario(mkMap({ 91: 100, 92: 0, 93: 500 }), { tarifaRegimen: 0.35 });
    expect(v.some((x) => x.renglon === 93 && x.nivel === "error")).toBe(true);
  });
});

describe("resumenValidaciones", () => {
  it("cuenta errores/warns/info y bloqueante", () => {
    const v = validarFormulario(mkMap({ 91: 100, 93: 500 }), { tarifaRegimen: null });
    const r = resumenValidaciones(v);
    expect(r.errores).toBeGreaterThan(0);
    expect(r.bloqueante).toBe(true);
  });

  it("solo warns/info → no bloqueante", () => {
    const v = validarFormulario(mkMap({ 44: 100, 45: 200 }), { tarifaRegimen: 0.35 });
    const r = resumenValidaciones(v);
    expect(r.errores).toBe(0);
    expect(r.bloqueante).toBe(false);
  });
});
