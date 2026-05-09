import { describe, it, expect } from "vitest";
import {
  ID_CATEGORIAS,
  TARIFA_ID_DEFAULT,
  calcularFilaID,
  resumenID,
} from "./impuesto-diferido";

const cat = (id: string) => ID_CATEGORIAS.find((c) => c.id === id)!;

describe("ID_CATEGORIAS", () => {
  it("9 activos + 7 pasivos = 16 categorías", () => {
    expect(ID_CATEGORIAS.length).toBe(16);
    expect(ID_CATEGORIAS.filter((c) => c.tipo === "activo").length).toBe(9);
    expect(ID_CATEGORIAS.filter((c) => c.tipo === "pasivo").length).toBe(7);
  });

  it("activos mapean a filas del F2516", () => {
    const efectivo = cat("ACT_01_EFECTIVO");
    expect(efectivo.f2516FilaId).toBe("ESF_01_EFECTIVO");
    expect(cat("ACT_06_PPE").f2516FilaId).toBe("ESF_07_PPE");
    expect(cat("ACT_08_BIO").f2516FilaId).toBe("ESF_06_BIO");
  });
});

describe("calcularFilaID · ACTIVOS", () => {
  const tarifa = TARIFA_ID_DEFAULT;

  it("contable < fiscal · genera diferencia DEDUCIBLE → ID Activo", () => {
    // Contable 100M, Fiscal 130M → deducible 30M × 35% = 10.5M → 11M (redondeo)
    const r = calcularFilaID({
      categoria: cat("ACT_04_INVENT"),
      baseContable: 100_000_000,
      baseFiscal: 130_000_000,
      tarifa,
    });
    expect(r.difDeducible).toBe(30_000_000);
    expect(r.difImponible).toBe(0);
    expect(r.idActivo).toBe(10_500_000);
    expect(r.idPasivo).toBe(0);
  });

  it("contable > fiscal · genera diferencia IMPONIBLE → ID Pasivo", () => {
    // Contable 200M, Fiscal 150M → imponible 50M × 35% = 17.5M
    const r = calcularFilaID({
      categoria: cat("ACT_06_PPE"),
      baseContable: 200_000_000,
      baseFiscal: 150_000_000,
      tarifa,
    });
    expect(r.difImponible).toBe(50_000_000);
    expect(r.difDeducible).toBe(0);
    expect(r.idPasivo).toBe(17_500_000);
    expect(r.idActivo).toBe(0);
  });

  it("contable = fiscal · sin diferencias", () => {
    const r = calcularFilaID({
      categoria: cat("ACT_01_EFECTIVO"),
      baseContable: 50_000_000,
      baseFiscal: 50_000_000,
      tarifa,
    });
    expect(r.difDeducible).toBe(0);
    expect(r.difImponible).toBe(0);
    expect(r.idActivo).toBe(0);
    expect(r.idPasivo).toBe(0);
  });
});

describe("calcularFilaID · PASIVOS (signo invertido)", () => {
  const tarifa = TARIFA_ID_DEFAULT;

  it("contable > fiscal · genera DEDUCIBLE para pasivos", () => {
    // Pasivo: contable 100M, fiscal 80M → más contable que fiscal = deducible
    const r = calcularFilaID({
      categoria: cat("PAS_05_PROV_EST"),
      baseContable: 100_000_000,
      baseFiscal: 80_000_000,
      tarifa,
    });
    expect(r.difDeducible).toBe(20_000_000);
    expect(r.idActivo).toBe(7_000_000);
  });

  it("contable < fiscal · genera IMPONIBLE para pasivos", () => {
    const r = calcularFilaID({
      categoria: cat("PAS_01_OBLIGFIN"),
      baseContable: 50_000_000,
      baseFiscal: 70_000_000,
      tarifa,
    });
    expect(r.difImponible).toBe(20_000_000);
    expect(r.idPasivo).toBe(7_000_000);
  });
});

describe("calcularFilaID · redondeo DIAN", () => {
  it("redondea al múltiplo de 1.000", () => {
    // 1.234 × 35% = 431.9 → redondea a 0 (más cerca de 0)
    const r = calcularFilaID({
      categoria: cat("ACT_01_EFECTIVO"),
      baseContable: 0,
      baseFiscal: 1_234,
      tarifa: 0.35,
    });
    // dif=1234, ID=1234*0.35=431.9 → round(0.4319, -3) = 0
    expect(r.idActivo).toBe(0);
  });

  it("tarifa diferente a 35% (zona franca 20%)", () => {
    const r = calcularFilaID({
      categoria: cat("ACT_04_INVENT"),
      baseContable: 100_000_000,
      baseFiscal: 130_000_000,
      tarifa: 0.20,
    });
    // 30M × 20% = 6M
    expect(r.idActivo).toBe(6_000_000);
  });
});

describe("resumenID", () => {
  it("suma totales y calcula neto = pasivo - activo", () => {
    const filas = [
      calcularFilaID({
        categoria: cat("ACT_04_INVENT"),
        baseContable: 100_000_000,
        baseFiscal: 130_000_000,
        tarifa: 0.35,
      }), // ID-A 10.5M
      calcularFilaID({
        categoria: cat("ACT_06_PPE"),
        baseContable: 200_000_000,
        baseFiscal: 150_000_000,
        tarifa: 0.35,
      }), // ID-P 17.5M
    ];
    const r = resumenID(filas);
    expect(r.totalActivoID).toBe(10_500_000);
    expect(r.totalPasivoID).toBe(17_500_000);
    expect(r.gastoIngresoNeto).toBe(7_000_000); // gasto > 0
  });

  it("ingreso neto cuando ID-A > ID-P", () => {
    const filas = [
      calcularFilaID({
        categoria: cat("ACT_04_INVENT"),
        baseContable: 100_000_000,
        baseFiscal: 200_000_000,
        tarifa: 0.35,
      }),
    ];
    const r = resumenID(filas);
    expect(r.gastoIngresoNeto).toBeLessThan(0); // ingreso (negativo)
  });

  it("array vacío · todos en cero", () => {
    const r = resumenID([]);
    expect(r.totalActivoID).toBe(0);
    expect(r.totalPasivoID).toBe(0);
    expect(r.gastoIngresoNeto).toBe(0);
  });
});

describe("constantes", () => {
  it("TARIFA_ID_DEFAULT = 0.35", () => {
    expect(TARIFA_ID_DEFAULT).toBe(0.35);
  });
});
