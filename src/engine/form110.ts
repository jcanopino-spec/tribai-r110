// Núcleo del cómputo del Formulario 110 AG 2025.
// Toma los inputs editados por el usuario + los totales de los anexos en
// `ComputeContext` y devuelve el mapa numérico con todos los renglones
// derivados. No muta el mapa de entrada.

import { normalizarSigno, sumRango, redondearDIAN } from "./utils";
import {
  calcularSancionExtemporaneidad,
  calcularSancionCorreccion,
} from "./sanciones";
import { calcularImpuestoAdicionar } from "./tasa-minima";

export const RENGLONES_COMPUTADOS = new Set<number>([
  // Datos informativos · nómina (vienen de /configuracion tab Otros)
  33, // Total costos y gastos de nómina
  34, // Aportes al sistema de seguridad social
  35, // Aportes al SENA, ICBF, cajas
  // Patrimonio
  44, // Total patrimonio bruto = sum(36..43)
  46, // Total patrimonio líquido = max(0, 44 - 45)
  // Ingresos · dividendos (vienen del Anexo 18)
  49, 50, 51, 52, 53, 54, 55, 56,
  // Ingresos
  58, // Total ingresos brutos = sum(47..57)
  60, // INCRNGO · viene del Anexo 26
  61, // Total ingresos netos = max(0, 58 - 59 - 60)
  // Costos
  67, // Total costos y gastos deducibles = sum(62..66)
  68, // Inversiones ESAL efectuadas en el año (Art. 358 E.T.)
  69, // Inversiones ESAL liquidadas en años anteriores
  // Renta
  70, // Renta por recuperación de deducciones · viene del Anexo 17
  72, // Renta líquida ordinaria = max(0, 61 + 69 + 70 + 71 - 52..56 - 67 - 68)
  73, // Pérdida líquida ordinaria (espejo de 72)
  74, // Compensaciones · viene del Anexo 20
  75, // Renta líquida = max(0, 72 - 74)
  76, // Renta presuntiva · viene del Anexo 1
  77, // Rentas exentas · viene del Anexo 19
  79, // Renta líquida gravable = max(75, 76) - 77 + 78
  // Ganancias ocasionales
  80, // Ingresos por GO · viene del Anexo 8
  81, // Costos por GO · viene del Anexo 8
  82, // GO no gravadas y exentas · viene del Anexo 8
  83, // Ganancias ocasionales gravables = max(0, 80 - 81 - 82)
  // Liquidación privada
  84, // Impuesto sobre la renta líquida gravable = 79 × tarifa del régimen
  85, // Sobretasa instituciones financieras (Par. 1° Art. 240 E.T.)
  86, // Impuesto sobre dividendos al 10%/20% (base R51+R55)
  88, // Impuesto sobre dividendos megainversiones 27% (base R56)
  89, // Impuesto sobre dividendos no residentes Art. 240 (base R53)
  90, // Impuesto sobre dividendos no residentes Art. 245 33% (base R52)
  91, // Total impuesto sobre rentas líquidas gravables = sum(84..90)
  93, // Descuentos tributarios · viene del Anexo 4
  97, // Impuesto neto de ganancias ocasionales = 83 × 15%
  105, // Autorretenciones · viene del Anexo 3
  106, // Otras retenciones · viene del Anexo 3
  108, // Anticipo año siguiente (Anexo 2 del .xlsm)
  112, // Sanciones (extemporaneidad + corrección, Arts. 641/642/644 E.T.)
  94, // Impuesto neto de renta (sin adicionado) = 91 + 92 - 93
  96, // Impuesto neto de renta (con adicionado) = 94 + 95
  99, // Total impuesto a cargo = 96 + 97 - 98
  107, // Total retenciones = 105 + 106
  111, // Saldo a pagar por impuesto = 99 + 108 + 110 - 100..104 - 107 - 109
  113, // Total saldo a pagar = 99 + 108 + 110 + 112 - 100..104 - 107 - 109
  114, // Total saldo a favor = 100..104 + 107 + 109 - 99 - 108 - 110 - 112
]);

// Tarifa fija para Ganancias Ocasionales (Art. 313 E.T., reformas posteriores).
// Para AG 2025 es 15% (Ley 2277 de 2022 elevó del 10% al 15%).
export const TARIFA_GANANCIAS_OCASIONALES = 0.15;

export type ComputeContext = {
  /** Tarifa del régimen del declarante (0..1). Si no se provee, 84 queda en 0. */
  tarifaRegimen?: number;
  /** Impuesto neto de renta del año gravable anterior (entrada del usuario). */
  impuestoNetoAnterior?: number;
  /** Años que la empresa lleva declarando, define la tarifa del anticipo. */
  aniosDeclarando?: "primero" | "segundo" | "tercero_o_mas";
  /** Estado de presentación calculado en engine/vencimientos.ts */
  presentacion?: { estado: "no_presentada" | "oportuna" | "extemporanea"; mesesExtemporanea?: number };
  /** Flag de sanción extemporaneidad activado por el usuario */
  calculaSancionExtemporaneidad?: boolean;
  /** Flag de sanción por corrección activado */
  calculaSancionCorreccion?: boolean;
  /** Mayor valor a pagar / menor saldo a favor por la corrección */
  mayorValorCorreccion?: number;
  /** ¿Existe emplazamiento previo? Cambia las tarifas del Art. 641 → 642 E.T. */
  existeEmplazamiento?: boolean;
  /** Reducción del Art. 640 E.T.: '0' | '50' | '75' */
  reduccionSancion?: "0" | "50" | "75";
  /** UVT vigente para la liquidación de la sanción (año de presentación). */
  uvtVigente?: number;
  /** Patrimonio líquido año gravable anterior (para sanción cuando no hay impuesto/ingresos). */
  patrimonioLiquidoAnterior?: number;
  /** ¿Es institución financiera/aseguradora? Sobretasa 5pp Par. 1 Art. 240 sobre exceso de 120.000 UVT. */
  esInstitucionFinanciera?: boolean;
  /**
   * Sobretasa Art. 240 según tipo de actividad. Permite distinguir los 4 casos:
   *   - 'financiera'    · 5pp sobre exceso 120.000 UVT (Par. 1, AG 2023-2027)
   *   - 'hidroelectrica'· 3pp sobre exceso 30.000 UVT  (Par. 4)
   *   - 'extractora'    · puntos según precio promedio del año (Par. 2 · carbón/petróleo)
   *   - 'ninguna'       · sin sobretasa
   * Si está sin definir y `esInstitucionFinanciera=true` se asume 'financiera' por compat.
   */
  tipoSobretasa?: "ninguna" | "financiera" | "hidroelectrica" | "extractora";
  /** Para extractoras Art. 240 par. 2 · puntos adicionales según precio (calc externo). 0..15. */
  puntosSobretasaExtractora?: number;
  /** ¿Aplica Tasa Mínima de Tributación Depurada (Art. 240 par. 6° E.T.)? */
  aplicaTasaMinima?: boolean;
  /** Utilidad contable antes de impuestos (utilidad_contable − perdida_contable). Para fórmula TTD. */
  utilidadContableNeta?: number;
  /** Σ diferencias permanentes que aumentan la renta (de la conciliación). Para fórmula TTD. */
  difPermanentesAumentan?: number;
  /** Valor ingreso método de participación patrimonial. Para fórmula TTD. Default 0. */
  vimpp?: number;
  /** Datos de nómina (vienen de /configuracion tab Otros) */
  totalNomina?: number;
  aportesSegSocial?: number;
  aportesParaFiscales?: number;
  /** Anexo 3 · totales de retenciones y autorretenciones */
  totalAutorretenciones?: number;
  totalRetenciones?: number;
  /** Anexo 4 · total de descuentos tributarios */
  totalDescuentosTributarios?: number;
  /** Anexo 8 · totales de ganancia ocasional */
  goIngresos?: number;
  goCostos?: number;
  goNoGravada?: number;
  /**
   * Anexo 19 · total rentas exentas → R77.
   * Si `totalRentasExentasConTope` está definido, ese valor se considera el monto SUJETO al
   * tope del 10% de la renta líquida (Art. 235-2 par. 5). El resto (sin tope) entra
   * directo. La fórmula resultante es:
   *   R77 = totalRentasExentas + min(totalRentasExentasConTope, max(0, R75 + R76) × 10%)
   */
  totalRentasExentas?: number;
  /** Subconjunto de rentas exentas sujeto al tope del 10% RL (Art. 235-2 par. 5). */
  totalRentasExentasConTope?: number;
  /** Año gravable de la declaración · para validar plazo de compensaciones (Art. 147). */
  anoGravable?: number;
  /**
   * Anexo 20 · total compensaciones → R74.
   * Si `compensacionesConAno` está definido, se valida el plazo de 12 años del Art. 147
   * y se ignoran las pérdidas vencidas. `totalCompensaciones` queda como fallback.
   */
  totalCompensaciones?: number;
  /** Compensaciones con año de origen para validar plazo · pérdidas con `año >= anoGravable - 12`. */
  compensacionesConAno?: { ano_origen: number; compensar: number }[];
  /** Anexo 17 · total recuperación de deducciones → R70 */
  totalRecuperaciones?: number;
  /** Anexo Inversiones ESAL · total efectuadas → R68 (deducción ESAL Art. 358) */
  totalInversionesEsalEfectuadas?: number;
  /** Anexo Inversiones ESAL · total liquidadas → R69 (recuperación ESAL) */
  totalInversionesEsalLiquidadas?: number;
  /** Anexo 1 · renta presuntiva calculada → R76 */
  rentaPresuntiva?: number;
  /** Anexo 18 · dividendos por categoría (R49..R56) */
  dividendos?: {
    r49?: number;
    r50?: number;
    r51?: number;
    r52?: number;
    r53?: number;
    r54?: number;
    r55?: number;
    r56?: number;
  };
  /** Anexo 26 · INCRNGO total → R60 */
  totalIncrngo?: number;
};

const TARIFA_ANTICIPO: Record<NonNullable<ComputeContext["aniosDeclarando"]>, number> = {
  primero: 0.25,
  segundo: 0.5,
  tercero_o_mas: 0.75,
};

// Sobretasas del Art. 240 por tipo de actividad (umbral en UVT + puntos adicionales)
//   Par. 1° · financieras y aseguradoras: 5pp sobre exceso de 120.000 UVT (AG 2023-2027)
//   Par. 4° · hidroeléctricas:            3pp sobre exceso de  30.000 UVT
//   Par. 2° · extractoras:                puntos variables según precio del año
const SOBRETASAS = {
  financiera: { umbralUVT: 120000, puntos: 0.05 },
  hidroelectrica: { umbralUVT: 30000, puntos: 0.03 },
} as const;

// Compatibilidad · alias usados en versiones previas
const UMBRAL_SOBRETASA_UVT = 120000;
const PUNTOS_SOBRETASA = 0.05;
// Plazo del Art. 147 E.T. · pérdidas fiscales compensables hasta 12 períodos siguientes
const PLAZO_COMPENSACION_ANOS = 12;
// Tope del Art. 235-2 par. 5 · rentas exentas sujetas al límite (10% RL)
const TOPE_RENTAS_EXENTAS = 0.1;

/**
 * Calcula los valores derivados a partir de los inputs.
 * No muta el mapa original. Devuelve un nuevo mapa con los computados aplicados.
 *
 * IMPORTANTE: el orden de cálculo importa porque hay computados que dependen
 * de otros computados (e.g., 79 usa 75; 84 usa 79; 91 usa 84; 96 usa 94).
 */
export function computarRenglones(
  valores: Map<number, number>,
  ctx: ComputeContext = {},
): Map<number, number> {
  const v = new Map<number, number>();
  // Normalizamos signo en la entrada: cualquier valor que llegue en un renglón
  // que el formulario espera positivo se convierte a abs() antes de calcular.
  // Esto cubre datos cargados antes de la normalización en escritura.
  for (const [n, val] of valores) v.set(n, normalizarSigno(n, val));
  const get = (n: number) => v.get(n) ?? 0;

  // --- Datos informativos · nómina (sólo si se proveyeron, sino mantienen el valor previo en DB) ---
  if (typeof ctx.totalNomina === "number") v.set(33, ctx.totalNomina);
  if (typeof ctx.aportesSegSocial === "number") v.set(34, ctx.aportesSegSocial);
  if (typeof ctx.aportesParaFiscales === "number") v.set(35, ctx.aportesParaFiscales);

  // --- INCRNGO (Anexo 26) → R60 ---
  if (typeof ctx.totalIncrngo === "number") {
    v.set(60, ctx.totalIncrngo);
  }

  // --- Ingresos por dividendos (Anexo 18) ---
  if (ctx.dividendos) {
    if (typeof ctx.dividendos.r49 === "number") v.set(49, ctx.dividendos.r49);
    if (typeof ctx.dividendos.r50 === "number") v.set(50, ctx.dividendos.r50);
    if (typeof ctx.dividendos.r51 === "number") v.set(51, ctx.dividendos.r51);
    if (typeof ctx.dividendos.r52 === "number") v.set(52, ctx.dividendos.r52);
    if (typeof ctx.dividendos.r53 === "number") v.set(53, ctx.dividendos.r53);
    if (typeof ctx.dividendos.r54 === "number") v.set(54, ctx.dividendos.r54);
    if (typeof ctx.dividendos.r55 === "number") v.set(55, ctx.dividendos.r55);
    if (typeof ctx.dividendos.r56 === "number") v.set(56, ctx.dividendos.r56);
  }

  // --- Patrimonio ---
  const r44 = sumRango(v, 36, 43);
  v.set(44, r44);
  v.set(46, Math.max(0, r44 - get(45)));

  // --- Ingresos ---
  const r58 = sumRango(v, 47, 57);
  v.set(58, r58);
  v.set(61, Math.max(0, r58 - get(59) - get(60)));

  // --- Costos ---
  v.set(67, sumRango(v, 62, 66));

  // --- Anexos que alimentan la base de R72 ---
  // 70 = Renta por recuperación de deducciones (Anexo 17). DEBE setearse
  // antes del cálculo de R72 porque la base de R72 incluye R70.
  if (typeof ctx.totalRecuperaciones === "number") {
    v.set(70, ctx.totalRecuperaciones);
  }
  // 68 · Inversiones ESAL efectuadas en el año (Anexo Inv. ESAL).
  // 69 · Inversiones ESAL liquidadas en años anteriores.
  // Setear ANTES del cálculo de R72: R72 RESTA R68 y SUMA R69 a la base.
  if (typeof ctx.totalInversionesEsalEfectuadas === "number") {
    v.set(68, ctx.totalInversionesEsalEfectuadas);
  }
  if (typeof ctx.totalInversionesEsalLiquidadas === "number") {
    v.set(69, ctx.totalInversionesEsalLiquidadas);
  }

  // --- Renta líquida ordinaria / pérdida ---
  // 72 = max(0, 61 + 69 + 70 + 71 - 52 - 53 - 54 - 55 - 56 - 67 - 68)
  // 73 = espejo de 72 (cuando es negativo)
  // Las restas 52..56 son dividendos gravados a tarifas especiales que NO
  // entran a la renta ordinaria (se gravan aparte). 67 son costos totales.
  // 68 son inversiones ESAL del año.
  const baseRenta =
    get(61) + get(69) + get(70) + get(71) -
    get(52) - get(53) - get(54) - get(55) - get(56) -
    get(67) - get(68);
  v.set(72, Math.max(0, baseRenta));
  v.set(73, Math.max(0, -baseRenta));

  // --- Renta líquida ---
  // 76 = Renta presuntiva (Anexo 1)
  if (typeof ctx.rentaPresuntiva === "number") {
    v.set(76, ctx.rentaPresuntiva);
  }
  // 74 = Compensaciones (Anexo 20). Limitada al monto de la renta líquida (R72).
  // Validar plazo Art. 147 E.T.: solo se compensan pérdidas con año_origen ≥ anoGravable − 12.
  // Si se proveen las compensaciones con año, descartamos las vencidas.
  if (Array.isArray(ctx.compensacionesConAno) && typeof ctx.anoGravable === "number") {
    const anoMin = ctx.anoGravable - PLAZO_COMPENSACION_ANOS;
    const totalVigente = ctx.compensacionesConAno
      .filter((c) => c.ano_origen >= anoMin)
      .reduce((s, c) => s + (c.compensar || 0), 0);
    v.set(74, Math.min(totalVigente, get(72)));
  } else if (typeof ctx.totalCompensaciones === "number") {
    // Fallback · usuario provee total ya validado externamente
    v.set(74, Math.min(ctx.totalCompensaciones, get(72)));
  }
  // 75 = max(0, 72 - 74)
  v.set(75, Math.max(0, get(72) - get(74)));
  // 77 = Rentas exentas (Anexo 19) con TOPE 10% RL del Art. 235-2 par. 5.
  // El subconjunto `totalRentasExentasConTope` aplica el límite; el resto entra directo.
  if (
    typeof ctx.totalRentasExentas === "number" ||
    typeof ctx.totalRentasExentasConTope === "number"
  ) {
    const exentasSinTope = ctx.totalRentasExentas ?? 0;
    const exentasConTope = ctx.totalRentasExentasConTope ?? 0;
    // Base del tope: max(R75, R76) ANTES de restar R77 (la renta sobre la que aplica el límite)
    const baseTope = Math.max(get(75), get(76));
    const topeAplicable = Math.max(0, baseTope) * TOPE_RENTAS_EXENTAS;
    const exentasAcotadas = Math.min(exentasConTope, topeAplicable);
    v.set(77, exentasSinTope + exentasAcotadas);
  }
  // 79 = max(75, 76) - 77 + 78  (Renta líquida gravable)
  //   "al mayor valor entre 75 y 76 reste 77 y sume 78"
  v.set(79, Math.max(get(75), get(76)) - get(77) + get(78));

  // --- Ganancias ocasionales (vienen del Anexo 8) ---
  if (typeof ctx.goIngresos === "number") v.set(80, ctx.goIngresos);
  if (typeof ctx.goCostos === "number") v.set(81, ctx.goCostos);
  if (typeof ctx.goNoGravada === "number") v.set(82, ctx.goNoGravada);
  // 83 = max(0, 80 - 81 - 82)
  v.set(83, Math.max(0, get(80) - get(81) - get(82)));

  // --- Liquidación privada ---
  // 84 = Renta líquida gravable × tarifa del régimen
  //   Si no hay tarifa configurada en la empresa, queda en 0 (input seguro).
  if (typeof ctx.tarifaRegimen === "number" && ctx.tarifaRegimen > 0) {
    v.set(84, Math.round(Math.max(0, get(79)) * ctx.tarifaRegimen));
  } else if (!v.has(84)) {
    v.set(84, 0);
  }

  // 85 = Sobretasa Art. 240 según tipo de actividad. 4 ramas:
  //   · 'financiera'    · 5pp sobre exceso 120.000 UVT (Par. 1, AG 2023-2027)
  //   · 'hidroelectrica'· 3pp sobre exceso 30.000 UVT  (Par. 4)
  //   · 'extractora'    · puntos según precio promedio (Par. 2 · input externo)
  //   · 'ninguna'       · 0
  // Compat: si `tipoSobretasa` está sin definir y `esInstitucionFinanciera=true`
  // asumimos 'financiera' (comportamiento previo).
  const tipo: NonNullable<ComputeContext["tipoSobretasa"]> =
    ctx.tipoSobretasa ??
    (ctx.esInstitucionFinanciera ? "financiera" : "ninguna");
  if (tipo === "ninguna" || typeof ctx.uvtVigente !== "number" || ctx.uvtVigente <= 0) {
    v.set(85, 0);
  } else {
    const rentaGravable = Math.max(0, get(79));
    if (tipo === "extractora") {
      // Para extractoras el contribuyente provee los puntos según precio del año.
      const puntos = ctx.puntosSobretasaExtractora ?? 0;
      v.set(85, Math.round(rentaGravable * puntos));
    } else {
      const cfg = SOBRETASAS[tipo];
      const umbral = cfg.umbralUVT * ctx.uvtVigente;
      const exceso = Math.max(0, rentaGravable - umbral);
      v.set(85, Math.round(exceso * cfg.puntos));
    }
  }

  // 86, 88, 89, 90 · Impuesto sobre dividendos por categoría (catálogo DIAN AG 2025)
  //   R86 = (R51 + R55) × 20% · Dividendos gravados a la tarifa general (10% año 2022, 20% año 2023+)
  //   R88 = R56 × 27% · Dividendos megainversiones (base R56)
  //   R89 = R53 × 35% · Dividendos no residentes Art. 240 E.T. (base R53)
  //   R90 = R52 × 33% · Dividendos no residentes Art. 245 E.T. PN (base R52)
  //   Solo se calculan si el usuario NO los digitó manualmente.
  if (!v.has(86) || get(86) === 0) {
    const baseR86 = get(51) + get(55);
    if (baseR86 > 0) v.set(86, Math.round(baseR86 * 0.20));
  }
  if (!v.has(88) || get(88) === 0) {
    const baseR88 = get(56);
    if (baseR88 > 0) v.set(88, Math.round(baseR88 * 0.27));
  }
  if (!v.has(89) || get(89) === 0) {
    const baseR89 = get(53);
    if (baseR89 > 0) v.set(89, Math.round(baseR89 * 0.35));
  }
  if (!v.has(90) || get(90) === 0) {
    const baseR90 = get(52);
    if (baseR90 > 0) v.set(90, Math.round(baseR90 * 0.33));
  }

  // 97 = Ganancias ocasionales gravables × 15% (tarifa fija AG 2025)
  v.set(97, Math.round(Math.max(0, get(83)) * TARIFA_GANANCIAS_OCASIONALES));
  // 91 = sum(84..90)  (Total impuesto sobre rentas líquidas gravables)
  v.set(91, sumRango(v, 84, 90));
  // 93 = Descuentos tributarios (suma del Anexo 4) sujeto a tope Art. 259 E.T.
  //   Tope: 75% del impuesto básico de renta (renglón 84). Se calcula ANTES
  //   de R94 para que el tope aplique a la fórmula 91 + 92 - 93.
  if (typeof ctx.totalDescuentosTributarios === "number") {
    const tope = Math.max(0, get(84)) * 0.75;
    v.set(93, Math.min(ctx.totalDescuentosTributarios, tope));
  }
  // 94 = max(0, 91 + 92 - 93)  (Impuesto neto de renta sin impuesto adicionado)
  //   El Liquidador oficial fuerza ≥0: si los descuentos exceden el impuesto
  //   bruto, el neto queda en 0 (no puede ser negativo).
  v.set(94, Math.max(0, get(91) + get(92) - get(93)));
  // 95 = Impuesto a Adicionar (IA) · Tasa Mínima de Tributación (TTD)
  //   Fórmula oficial DIAN (Anexo "Tasa Mínima - TTD" del Liquidador 2025):
  //     ID = max(0, R94 + R92 + R93 − IRP)
  //     UD = max(0, UC + DPARL − R60 − VIMPP − R83 − R77 − R74)
  //     TTD = ID / UD
  //     IA = max(0, UD × 15% − ID)  si TTD < 15%
  //   Si aplicaTasaMinima=false (zonas francas, no residentes, etc.), o
  //   no tenemos utilidadContableNeta (caso anterior a esta feature),
  //   se respeta el R95 manual del usuario.
  if (
    ctx.aplicaTasaMinima !== false &&
    typeof ctx.utilidadContableNeta === "number"
  ) {
    const ia = calcularImpuestoAdicionar({
      aplica: true,
      inr: get(94),
      vaa: get(92),
      descuentosTributarios: get(93),
      impuestoRentasPasivas: 0,
      utilidadContable: ctx.utilidadContableNeta,
      difPermanentesAumentan: ctx.difPermanentesAumentan ?? 0,
      incrngo: get(60),
      vimpp: ctx.vimpp ?? 0,
      gananciaOcasionalGravable: get(83),
      rentasExentas: get(77),
      compensaciones: get(74),
    });
    if (ia > 0) v.set(95, ia);
  }
  // 96 = 94 + 95  (Impuesto neto de renta con impuesto adicionado)
  v.set(96, get(94) + get(95));
  // 99 = max(0, 96 + 97 - 98)  (Total impuesto a cargo)
  //   También forzado ≥0 en el Liquidador oficial.
  v.set(99, Math.max(0, get(96) + get(97) - get(98)));

  // 105 = Total autorretenciones (suma del Anexo 3)
  if (typeof ctx.totalAutorretenciones === "number") {
    v.set(105, ctx.totalAutorretenciones);
  }
  // 106 = Total retenciones (suma del Anexo 3)
  if (typeof ctx.totalRetenciones === "number") {
    v.set(106, ctx.totalRetenciones);
  }
  // 107 = 105 + 106  (Total retenciones)
  v.set(107, get(105) + get(106));

  // 112 = Sanción total = extemporaneidad + corrección (Arts. 641/642/644 E.T.)
  let sancionExt = 0;
  if (
    ctx.calculaSancionExtemporaneidad &&
    ctx.presentacion?.estado === "extemporanea" &&
    typeof ctx.uvtVigente === "number"
  ) {
    sancionExt = calcularSancionExtemporaneidad({
      meses: ctx.presentacion.mesesExtemporanea ?? 0,
      impuestoCargo: Math.max(0, get(99)),
      ingresosBrutos: get(58),
      patrimonioLiquidoAnterior: ctx.patrimonioLiquidoAnterior ?? 0,
      uvt: ctx.uvtVigente,
      existeEmplazamiento: !!ctx.existeEmplazamiento,
      reduccion: ctx.reduccionSancion ?? "0",
    });
  }
  let sancionCorr = 0;
  if (
    ctx.calculaSancionCorreccion &&
    typeof ctx.uvtVigente === "number" &&
    typeof ctx.mayorValorCorreccion === "number"
  ) {
    sancionCorr = calcularSancionCorreccion({
      mayorValor: ctx.mayorValorCorreccion,
      uvt: ctx.uvtVigente,
      existeEmplazamiento: !!ctx.existeEmplazamiento,
      reduccion: ctx.reduccionSancion ?? "0",
    });
  }
  v.set(112, sancionExt + sancionCorr);

  // 108 = Anticipo año siguiente (Art. 807 E.T.)
  //   El Liquidador oficial implementa los DOS métodos del Anexo 2 y toma
  //   el MENOR (más favorable al contribuyente):
  //     Método 1 (F18) = ((impuesto_neto_actual + impuesto_neto_ant) / 2) × tarifa − R107
  //     Método 2 (G18) = impuesto_neto_actual × tarifa − R107
  //   Primer año: 0 (no aplica). En años posteriores: max(0, MIN(metodo1, metodo2)).
  if (
    typeof ctx.impuestoNetoAnterior === "number" &&
    typeof ctx.aniosDeclarando === "string"
  ) {
    if (ctx.aniosDeclarando === "primero") {
      v.set(108, 0);
    } else {
      const tarifa = TARIFA_ANTICIPO[ctx.aniosDeclarando];
      const retenciones = get(107);
      const promedio = (get(96) + ctx.impuestoNetoAnterior) / 2;
      const metodo1 = Math.max(0, promedio * tarifa - retenciones);
      const metodo2 = Math.max(0, get(96) * tarifa - retenciones);
      v.set(108, Math.round(Math.min(metodo1, metodo2)));
    }
  } else if (!v.has(108)) {
    v.set(108, 0);
  }

  // 111 = Saldo a pagar por impuesto
  //   = 99 + 108 + 110 - 100 - 101 - 102 - 103 - 104 - 107 - 109
  const restas = get(100) + get(101) + get(102) + get(103) + get(104) + get(107) + get(109);
  const r111 = get(99) + get(108) + get(110) - restas;
  v.set(111, Math.max(0, r111));

  // 113 = Total saldo a pagar
  //   = 99 + 108 + 110 + 112 - (mismo conjunto de restas)
  const r113 = get(99) + get(108) + get(110) + get(112) - restas;
  v.set(113, Math.max(0, r113));

  // 114 = Total saldo a favor (espejo de 113: si las restas exceden, hay saldo a favor)
  v.set(114, Math.max(0, restas - (get(99) + get(108) + get(110) + get(112))));

  // Redondeo DIAN: el Liquidador oficial aplica ROUND(x, -3) a todos los
  // renglones a nivel de Hoja Sumaria (cada renglón individual está
  // redondeado a múltiplos de 1.000 antes de sumar). Replicamos eso aquí:
  // todos los valores monetarios de la salida son múltiplos de 1.000.
  //
  // Los datos del usuario en DB mantienen su precisión original — el
  // redondeo es sólo para la SALIDA computada que se presenta/exporta.
  for (const [n, val] of v) {
    v.set(n, redondearDIAN(val));
  }

  return v;
}

/**
 * Notas contextuales de algunos renglones (regulación, alcance, advertencias).
 * Aparecen como tooltip o subtítulo gris bajo la descripción del renglón.
 */
export const NOTAS_RENGLON: Record<number, string> = {
  76:
    "Para AG 2024+ la renta presuntiva es 0% (Ley 2277/2022 mantuvo la base en 0). " +
    "Solo digitar si tienes obligaciones específicas que la mantengan.",
  85:
    "Sobretasa: aplica a entidades financieras (Art. 240 par. 1° E.T.), extractoras de petróleo, " +
    "carbón y a generadoras hidroeléctricas. No aplica a la mayoría de PJ del régimen ordinario.",
  86:
    "Dividendos gravados a la tarifa del 10%. Solo si tienes dividendos en esa categoría específica.",
  87:
    "Dividendos gravados a la tarifa del Art. 245 E.T. (no residentes / 35%). Categoría especial.",
  88:
    "Dividendos gravados a la tarifa del 20% (Ley 1819/2016 antes de Ley 2277/2022). Casos transitorios.",
  89:
    "Dividendos gravados a la tarifa del 35%. Aplicable según condiciones del Art. 240 E.T.",
  90:
    "Dividendos gravados a la tarifa del 33% (categoría histórica). Solo si aplica.",
  92:
    "Valor adicional (VAA): ajustes positivos al impuesto sobre la renta. Casos especiales.",
  95:
    "Impuesto a adicionar (IA): ajustes complementarios. Casos especiales.",
  100:
    "Inversión en obras por impuestos (Modalidad de pago 1): hasta 50% del impuesto neto. Decreto 1915/2017.",
  101:
    "Descuento efectivo por obras por impuestos (Modalidad de pago 2): por la inversión efectivamente girada.",
  102:
    "Crédito fiscal por inversión en investigación, desarrollo e innovación (Art. 256-1 E.T.).",
};

/**
 * Pequeña descripción de cada fórmula para mostrar como subtítulo del renglón.
 */
export const FORMULAS_LEYENDA: Record<number, string> = {
  44: "Suma de 36 a 43",
  46: "44 − 45 (si positivo)",
  58: "Suma de 47 a 57",
  61: "58 − 59 − 60 (si positivo)",
  67: "Suma de 62 a 66",
  72: "61 + 69 + 70 + 71 − (52..56) − 67 − 68 (si positivo)",
  49: "Dividendos · No constitutivos",
  50: "Dividendos · Distribuidos no residentes",
  51: "Dividendos · Tarifa general",
  52: "Dividendos · Persona natural residente",
  53: "Dividendos · No residentes (PN)",
  54: "Dividendos · Art. 245",
  55: "Dividendos · Ley 1819",
  56: "Dividendos · Proyectos calificados",
  60: "Suma de INCRNGO",
  70: "Suma de recuperaciones",
  73: "Espejo de 72 (si la base es negativa)",
  74: "Compensaciones (limitado a la renta líquida 72)",
  75: "72 − 74 (si positivo)",
  76: "Renta Presuntiva",
  77: "Suma de rentas exentas",
  79: "max(75, 76) − 77 + 78",
  80: "Suma precios de venta · Ganancia Ocasional",
  81: "Suma costos fiscales · Ganancia Ocasional",
  82: "Suma no gravadas/exentas · Ganancia Ocasional",
  83: "80 − 81 − 82 (si positivo)",
  84: "79 × tarifa del régimen",
  85: "5% sobre exceso de 79 sobre 120.000 UVT (instituciones financieras)",
  91: "Suma de 84 a 90",
  93: "Descuentos tributarios (limitado al 75% del impto. básico, Art. 259 E.T.)",
  97: "83 × 15% (tarifa GO)",
  94: "91 + 92 − 93",
  96: "94 + 95",
  99: "96 + 97 − 98",
  105: "Suma de autorretenciones",
  106: "Suma de retenciones",
  107: "105 + 106",
  108: "(96 + impto. AG anterior) / 2 × tarifa años − 107",
  112: "Sanciones (extemporaneidad + corrección, Arts. 641/642/644 E.T.)",
  111: "99 + 108 + 110 − 100 − 101 − 102 − 103 − 104 − 107 − 109",
  113: "99 + 108 + 110 + 112 − (restas de 111)",
  114: "Diferencia (saldo a favor) si las restas exceden",
};
