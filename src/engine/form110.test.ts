import { describe, it, expect } from "vitest";
import {
  computarRenglones,
  TARIFA_GANANCIAS_OCASIONALES,
  type ComputeContext,
} from "./form110";

const UVT = 49_799;

// Helper: ejecuta computarRenglones y devuelve get(n)
function compute(input: Record<number, number>, ctx: ComputeContext = {}) {
  const m = new Map<number, number>(Object.entries(input).map(([k, v]) => [Number(k), v]));
  const out = computarRenglones(m, ctx);
  return (n: number) => out.get(n) ?? 0;
}

describe("computarRenglones · Patrimonio", () => {
  it("R44 = suma 36..43; R46 = max(0, 44 − 45)", () => {
    const g = compute({ 36: 100_000_000, 37: 50_000_000, 38: 30_000_000, 45: 60_000_000 });
    expect(g(44)).toBe(180_000_000);
    expect(g(46)).toBe(120_000_000);
  });

  it("R46 nunca negativo (pasivos > activos)", () => {
    const g = compute({ 36: 10_000_000, 45: 50_000_000 });
    expect(g(46)).toBe(0);
  });

  it("R45 (pasivos) se normaliza a positivo aunque venga negativo", () => {
    // Cuentas clase 2 vienen en negativo del balance
    const g = compute({ 36: 100_000_000, 45: -40_000_000 });
    expect(g(46)).toBe(60_000_000); // 100M - |40M|
  });
});

describe("computarRenglones · Ingresos", () => {
  it("R58 = suma 47..57; R61 = max(0, 58 − 59 − 60)", () => {
    const g = compute({ 47: 1_000_000_000, 48: 50_000_000, 59: 20_000_000 }, { totalIncrngo: 10_000_000 });
    expect(g(58)).toBe(1_050_000_000);
    expect(g(60)).toBe(10_000_000);
    expect(g(61)).toBe(1_020_000_000);
  });

  it("ingresos se normalizan a positivo aunque vengan crédito", () => {
    const g = compute({ 47: -1_000_000_000 });
    expect(g(58)).toBe(1_000_000_000);
  });

  it("dividendos del Anexo 18 alimentan R49..R56", () => {
    const g = compute(
      {},
      {
        dividendos: {
          r49: 1_000_000,
          r50: 2_000_000,
          r51: 3_000_000,
          r52: 4_000_000,
          r53: 5_000_000,
          r54: 6_000_000,
          r55: 7_000_000,
          r56: 8_000_000,
        },
      },
    );
    expect(g(49)).toBe(1_000_000);
    expect(g(56)).toBe(8_000_000);
  });
});

describe("computarRenglones · ESAL Inversiones (R68/R69)", () => {
  it("totalInversionesEsalEfectuadas → R68 (resta a la base de R72)", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      { totalInversionesEsalEfectuadas: 50_000_000 },
    );
    expect(g(68)).toBe(50_000_000);
    // Base = R61 - R67 - R68 = 1.000 - 600 - 50 = 350M
    expect(g(72)).toBe(350_000_000);
  });

  it("totalInversionesEsalLiquidadas → R69 (suma a la base de R72)", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      { totalInversionesEsalLiquidadas: 30_000_000 },
    );
    expect(g(69)).toBe(30_000_000);
    // Base = R61 + R69 - R67 = 1.000 + 30 - 600 = 430M
    expect(g(72)).toBe(430_000_000);
  });

  it("efectuadas + liquidadas combinadas", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 500_000_000 },
      {
        totalInversionesEsalEfectuadas: 100_000_000,
        totalInversionesEsalLiquidadas: 20_000_000,
      },
    );
    // Base = 1.000 + 20 - 500 - 100 = 420M
    expect(g(72)).toBe(420_000_000);
  });
});

describe("computarRenglones · Renta líquida ordinaria (R72/R73)", () => {
  it("R72 = max(0, 61 + 70 - 67)", () => {
    // Caso sencillo: ingresos netos 1.000M, costos 600M, sin recuperaciones
    const g = compute({ 47: 1_000_000_000, 62: 600_000_000 });
    expect(g(67)).toBe(600_000_000);
    expect(g(72)).toBe(400_000_000);
    expect(g(73)).toBe(0);
  });

  it("R73 espejo cuando hay pérdida ordinaria", () => {
    // Costos > ingresos
    const g = compute({ 47: 100_000_000, 62: 500_000_000 });
    expect(g(72)).toBe(0);
    expect(g(73)).toBe(400_000_000);
  });

  it("dividendos R52..R56 se restan de la base ordinaria (van a tarifas especiales)", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 100_000_000 },
      {
        dividendos: { r52: 50_000_000, r53: 30_000_000 },
      },
    );
    // R58 = 47 + 52 + 53 = 1.080M; R67 = 100M
    // Base = R61 - 52 - 53 - R67 = 1.080 - 50 - 30 - 100 = 900M
    expect(g(58)).toBe(1_080_000_000);
    expect(g(72)).toBe(900_000_000);
  });

  it("R70 (recuperaciones) suma a la base", () => {
    const g = compute({ 47: 100_000_000 }, { totalRecuperaciones: 50_000_000 });
    expect(g(70)).toBe(50_000_000);
    expect(g(72)).toBe(150_000_000);
  });
});

describe("computarRenglones · R75/R79", () => {
  it("R74 (compensaciones) limitada a R72", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      { totalCompensaciones: 1_000_000_000 },
    );
    expect(g(72)).toBe(400_000_000);
    expect(g(74)).toBe(400_000_000); // limitada al monto de 72
  });

  it("R75 = max(0, 72 − 74)", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      { totalCompensaciones: 100_000_000 },
    );
    expect(g(75)).toBe(300_000_000);
  });

  it("R79 = max(75,76) − 77 + 78", () => {
    // R75 = 400M, R76 = 0, R77 = 50M, R78 = 0 → R79 = 350M
    const g = compute({ 47: 1_000_000_000, 62: 600_000_000 }, { totalRentasExentas: 50_000_000 });
    expect(g(77)).toBe(50_000_000);
    expect(g(79)).toBe(350_000_000);
  });

  it("R79 toma el mayor entre 75 y 76 (renta presuntiva)", () => {
    // R75 = 200M, presuntiva 76 = 300M → R79 toma 300M
    const g = compute({ 47: 1_000_000_000, 62: 800_000_000 }, { rentaPresuntiva: 300_000_000 });
    expect(g(75)).toBe(200_000_000);
    expect(g(76)).toBe(300_000_000);
    expect(g(79)).toBe(300_000_000);
  });
});

describe("computarRenglones · Ganancias ocasionales", () => {
  it("R83 = max(0, 80 − 81 − 82); R97 = R83 × 15%", () => {
    const g = compute(
      {},
      { goIngresos: 100_000_000, goCostos: 30_000_000, goNoGravada: 10_000_000 },
    );
    expect(g(83)).toBe(60_000_000);
    expect(g(97)).toBe(redondear(60_000_000 * 0.15));
  });

  it("R83 = 0 si 81+82 > 80", () => {
    const g = compute({}, { goIngresos: 50_000_000, goCostos: 80_000_000, goNoGravada: 0 });
    expect(g(83)).toBe(0);
    expect(g(97)).toBe(0);
  });

  it("tarifa GO es 15% (Ley 2277/2022)", () => {
    expect(TARIFA_GANANCIAS_OCASIONALES).toBe(0.15);
  });
});

describe("computarRenglones · Impuesto y descuentos", () => {
  it("R84 = R79 × tarifa del régimen", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      { tarifaRegimen: 0.35 },
    );
    // R79 = 400M → R84 = 140M
    expect(g(84)).toBe(140_000_000);
  });

  it("R93 (descuentos) topado al 75% del R84 · Art. 259", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      { tarifaRegimen: 0.35, totalDescuentosTributarios: 200_000_000 },
    );
    // R84 = 140M, tope = 105M
    expect(g(93)).toBe(redondear(105_000_000));
  });

  it("R94 = max(0, 91 + 92 − 93), nunca negativo", () => {
    // Forzamos descuentos enormes
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      { tarifaRegimen: 0.35, totalDescuentosTributarios: 1_000_000_000 },
    );
    expect(g(94)).toBe(redondear(140_000_000 * 0.25)); // 91=140M, 93 topeado a 105M → 94=35M
  });

  it("R96 = R94 + R95; R99 = max(0, 96 + 97 − 98)", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      { tarifaRegimen: 0.35, goIngresos: 100_000_000 },
    );
    expect(g(99)).toBe(redondear(140_000_000 + 15_000_000)); // 91=140M, 97=15M (GO 100M × 15%)
  });
});

describe("computarRenglones · Sobretasa financiera (R85)", () => {
  it("aplica solo si esInstitucionFinanciera + R79 ≥ 120.000 UVT", () => {
    const umbral = 120_000 * UVT; // ≈ 5.975 millones de millones (5.97 billones)
    const r79 = umbral + 1_000_000_000; // sobre el umbral

    // Necesitamos R47 muy grande para que R79 supere el umbral
    const g = compute(
      { 47: r79 + 100_000_000, 62: 100_000_000 },
      { esInstitucionFinanciera: true, uvtVigente: UVT },
    );
    expect(g(85)).toBeGreaterThan(0);
  });

  it("NO aplica si esInstitucionFinanciera=false", () => {
    const g = compute(
      { 47: 100_000_000_000_000 },
      { esInstitucionFinanciera: false, uvtVigente: UVT },
    );
    expect(g(85)).toBe(0);
  });

  it("NO aplica si R79 < 120.000 UVT", () => {
    const g = compute({ 47: 100_000_000 }, { esInstitucionFinanciera: true, uvtVigente: UVT });
    expect(g(85)).toBe(0);
  });
});

describe("computarRenglones · Anticipo (R108)", () => {
  it("primer año declarando = 0", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      { tarifaRegimen: 0.35, aniosDeclarando: "primero", impuestoNetoAnterior: 100_000_000 },
    );
    expect(g(108)).toBe(0);
  });

  it("segundo año: tarifa 50%, escoge el menor entre método 1 y 2", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      {
        tarifaRegimen: 0.35,
        aniosDeclarando: "segundo",
        impuestoNetoAnterior: 100_000_000,
        totalRetenciones: 0,
        totalAutorretenciones: 0,
      },
    );
    // R96 = 140M
    // Método 1: ((140 + 100)/2) × 50% = 60M
    // Método 2: 140 × 50% = 70M
    // Menor = 60M
    expect(g(108)).toBe(redondear(60_000_000));
  });

  it("tercero o más: tarifa 75%", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      {
        tarifaRegimen: 0.35,
        aniosDeclarando: "tercero_o_mas",
        impuestoNetoAnterior: 100_000_000,
      },
    );
    // R96 = 140M
    // Método 1: ((140+100)/2) × 75% = 90M
    // Método 2: 140 × 75% = 105M
    // Menor = 90M (después de retenciones=0)
    expect(g(108)).toBe(redondear(90_000_000));
  });

  it("retenciones reducen el anticipo", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      {
        tarifaRegimen: 0.35,
        aniosDeclarando: "tercero_o_mas",
        impuestoNetoAnterior: 100_000_000,
        totalRetenciones: 30_000_000,
        totalAutorretenciones: 0,
      },
    );
    expect(g(107)).toBe(30_000_000);
    // Método 1: 90M − 30M = 60M
    expect(g(108)).toBe(redondear(60_000_000));
  });
});

describe("computarRenglones · Sanciones (R112)", () => {
  it("0 si no se activa el flag", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      {
        tarifaRegimen: 0.35,
        uvtVigente: UVT,
        presentacion: { estado: "extemporanea", mesesExtemporanea: 3 },
      },
    );
    expect(g(112)).toBe(0);
  });

  it("calcula extemporaneidad cuando flag + estado=extemporanea", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      {
        tarifaRegimen: 0.35,
        uvtVigente: UVT,
        presentacion: { estado: "extemporanea", mesesExtemporanea: 3 },
        calculaSancionExtemporaneidad: true,
        existeEmplazamiento: false,
        reduccionSancion: "0",
      },
    );
    // R99 = 155M (140 + 15 si hubiera GO, aquí solo 140), 5%×3×140M ~= 21M
    expect(g(112)).toBeGreaterThan(0);
  });

  it("acumula extemporaneidad + corrección", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      {
        tarifaRegimen: 0.35,
        uvtVigente: UVT,
        presentacion: { estado: "extemporanea", mesesExtemporanea: 3 },
        calculaSancionExtemporaneidad: true,
        calculaSancionCorreccion: true,
        mayorValorCorreccion: 50_000_000,
        existeEmplazamiento: false,
        reduccionSancion: "0",
      },
    );
    expect(g(112)).toBeGreaterThan(20_000_000); // ext≈21M + corr=5M ≈ 26M
  });
});

describe("computarRenglones · Saldos finales (R111/R113/R114)", () => {
  it("R107 = R105 + R106", () => {
    const g = compute(
      {},
      { totalAutorretenciones: 5_000_000, totalRetenciones: 8_000_000 },
    );
    expect(g(107)).toBe(13_000_000);
  });

  it("R113 incluye sanciones; R111 NO", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      {
        tarifaRegimen: 0.35,
        uvtVigente: UVT,
        presentacion: { estado: "extemporanea", mesesExtemporanea: 3 },
        calculaSancionExtemporaneidad: true,
        reduccionSancion: "0",
      },
    );
    const r111 = g(111);
    const r113 = g(113);
    expect(r113).toBeGreaterThanOrEqual(r111);
    expect(r113 - r111).toBe(g(112));
  });

  it("R114 = saldo a favor cuando retenciones > impuesto", () => {
    const g = compute(
      { 47: 100_000_000 },
      {
        tarifaRegimen: 0.35,
        totalRetenciones: 50_000_000,
      },
    );
    // R99 ≈ 35M (R47=100, costos=0, R79=100, tarifa=35%)
    // Restas 107 = 50M > 35M → saldo a favor
    expect(g(114)).toBeGreaterThan(0);
    expect(g(111)).toBe(0); // saldo a pagar = 0
  });
});

describe("computarRenglones · Tasa Mínima R95", () => {
  it("NO calcula R95 si aplicaTasaMinima=false", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 100_000_000 },
      {
        tarifaRegimen: 0.35,
        aplicaTasaMinima: false,
        utilidadContableNeta: 800_000_000,
      },
    );
    expect(g(95)).toBe(0);
  });

  it("NO calcula R95 si no hay utilidadContableNeta (backward compat)", () => {
    const g = compute(
      { 47: 1_000_000_000, 62: 600_000_000 },
      { tarifaRegimen: 0.35, aplicaTasaMinima: true },
    );
    expect(g(95)).toBe(0);
  });

  it("calcula R95 cuando TTD < 15%", () => {
    // Setup: R94 muy bajo vs UD alto → IA > 0
    // R47=1.000M, R62=100M → R72=900, R75=900, R79=900
    // R84 = 900M × 9% = 81M (tarifa baja para TTD bajo)
    // Si UC=900M, UD≈900M, ID≈81M → TTD≈9% < 15%
    // IA = 900M × 15% − 81M = 54M
    const g = compute(
      { 47: 1_000_000_000, 62: 100_000_000 },
      {
        tarifaRegimen: 0.09,
        aplicaTasaMinima: true,
        utilidadContableNeta: 900_000_000,
      },
    );
    expect(g(95)).toBeGreaterThan(0);
  });
});

describe("computarRenglones · Redondeo DIAN", () => {
  it("todos los valores de salida son múltiplos de 1.000", () => {
    const out = computarRenglones(
      new Map([
        [47, 1_234_567_891],
        [62, 600_000_123],
      ]),
      { tarifaRegimen: 0.35 },
    );
    for (const v of out.values()) {
      expect(v % 1000).toBe(0);
    }
  });
});

describe("computarRenglones · No mutation", () => {
  it("no muta el mapa de entrada", () => {
    const input = new Map<number, number>([[47, 100_000_000]]);
    const inputCopy = new Map(input);
    computarRenglones(input);
    expect(input).toEqual(inputCopy);
  });
});

describe("computarRenglones · Datos informativos nómina", () => {
  it("R33/R34/R35 vienen de ctx (auto desde anexo seg social)", () => {
    const g = compute(
      {},
      {
        totalNomina: 120_000_000,
        aportesSegSocial: 25_000_000,
        aportesParaFiscales: 12_000_000,
      },
    );
    expect(g(33)).toBe(redondear(120_000_000));
    expect(g(34)).toBe(redondear(25_000_000));
    expect(g(35)).toBe(redondear(12_000_000));
  });
});

function redondear(n: number): number {
  return Math.round(n / 1000) * 1000;
}
