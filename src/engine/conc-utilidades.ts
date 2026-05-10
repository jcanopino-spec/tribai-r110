// Engine puro · Conciliación de Utilidades (utilidad contable → renta fiscal).
//
// Replica la estructura de la hoja `Conc Utilidades` del .xlsm guía v5
// con las mejoras de la app:
//
//   1. Bloque PyG con 3 columnas (Contable | Fiscal | Diferencia) para
//      ingresos operacionales, no operacionales, devoluciones, costo de
//      ventas, gastos admin, gastos ventas, gastos no operacionales.
//      Contable = SUMIF balance por prefijo; Fiscal = renglones del F110.
//
//   2. Partidas de conciliación clasificadas según NIC 12 / IFRS:
//        · temporarias deducibles · revierten en periodos futuros, generan ATD
//        · temporarias imponibles · revierten en periodos futuros, generan PTD
//        · permanentes              · no revierten, sólo afectan la renta
//
//   3. Fórmula oficial:
//        RentaFiscal = Utilidad + ΔTempDeducibles − ΔTempImponibles + Permanentes
//      Esa fórmula reproduce exactamente el cuadre vs `Detalle Fiscal!L237`
//      (que en el F110 es R79 antes de aplicar exentas/sumar gravables).
//
//   4. Cuadre triple:
//        - vs R72 · renta líquida ordinaria (sin compensar)
//        - vs R75 · renta líquida (post compensaciones)
//        - vs R79 · renta líquida gravable (post exentas y gravables)
//
//   5. Estado: CUADRADO si |dif| ≤ TOLERANCIA, DESCUADRADO si supera.

export const TOLERANCIA = 1;

export type CategoriaConc = "temporaria_deducible" | "temporaria_imponible" | "permanente";

export type SignoConc = "mas" | "menos";

export type PartidaConc = {
  id: string;
  origen: "auto" | "manual";
  categoria: CategoriaConc;
  signo: SignoConc;
  concepto: string;
  valor: number;
  fuente?: string;
  observacion?: string | null;
};

/**
 * Bloque PyG · una fila por concepto del estado de resultados con
 * comparación contable vs fiscal. Mismas que la hoja Conc Utilidades del
 * guía (4 ingresos + 4 costos = 8 filas + totales).
 */
export type FilaPyG = {
  id: string;
  concepto: string;
  contable: number;
  fiscal: number;
  diferencia: number; // fiscal − contable
  esResta?: boolean; // marca devoluciones (se restan en el total)
  esTotal?: boolean;
};

export type ConcUtilidadesInput = {
  utilidadContableNeta: number; // utilidad − pérdida del año
  /** Saldos contables por prefijo PUC (vienen del balance). Cada uno es ABS. */
  contables: {
    ingOperacionales41: number; // SUMIF "41*"
    ingNoOperacionales42: number; // SUMIF "42*"
    devoluciones4175: number; // SUMIF "4175*"
    costoVenta6: number; // SUMIF "6*"
    gastosAdmin51: number; // SUMIF "51*"
    gastosVentas52: number; // SUMIF "52*"
    gastosNoOper53: number; // SUMIF "53*"
    gastosOtros54: number; // SUMIF "54*"
  };
  /** Renglones del F110 ya computados · usados para el lado fiscal y el cuadre. */
  valoresF110: Map<number, number>;
  /** Partidas de conciliación (auto + manuales). */
  partidas: PartidaConc[];
};

export type ConcUtilidadesResultado = {
  filasPyG: FilaPyG[];
  utilidadContableTotal: number;
  utilidadFiscalTotal: number;
  partidas: PartidaConc[];
  subtotales: {
    temporariasDeducibles: number;
    temporariasImponibles: number;
    permanentes: number;
    netoTotal: number; // ΔTempDed − ΔTempImp + Permanentes
  };
  rentaLiquidaCalculada: number;
  cuadres: {
    vsR72: { real: number; calculada: number; diferencia: number; ok: boolean };
    vsR75: { real: number; calculada: number; diferencia: number; ok: boolean };
    vsR79: { real: number; calculada: number; diferencia: number; ok: boolean };
  };
  estado: "cuadrado" | "descuadrado_leve" | "descuadrado";
};

/**
 * Aplica el signo de la partida a su valor (positivo si suma a la utilidad
 * fiscal, negativo si resta).
 */
export function valorConSigno(p: PartidaConc): number {
  return p.signo === "mas" ? p.valor : -p.valor;
}

/**
 * Suma las partidas de una categoría con su signo aplicado.
 */
export function sumarCategoria(
  partidas: PartidaConc[],
  categoria: CategoriaConc,
): number {
  return partidas
    .filter((p) => p.categoria === categoria)
    .reduce((s, p) => s + valorConSigno(p), 0);
}

/**
 * Computa la conciliación completa.
 *
 * El bloque PyG se construye con SUMIF al balance (lado contable) y los
 * renglones del F110 (lado fiscal). Las partidas de conciliación se suman
 * con signo: positivas suman a la utilidad fiscal, negativas restan.
 *
 * El cuadre vs R72 es el clásico (sin compensaciones, sin exentas).
 * El cuadre vs R75 es post-compensaciones. El cuadre vs R79 es la renta
 * gravable definitiva (incluye exentas y rentas gravables agregadas).
 */
export function computarConcUtilidades(
  input: ConcUtilidadesInput,
): ConcUtilidadesResultado {
  const c = input.contables;
  const v = (n: number) => input.valoresF110.get(n) ?? 0;

  // Bloque PyG · contable de balance, fiscal del F110
  const ingOperFiscal = v(47); // R47 ingresos brutos act ordinarias
  const ingNoOperFiscal = v(48) + v(57); // R48 financieros + R57 otros
  const devolucionesFiscal = v(59); // R59 devoluciones
  const costoVentaFiscal = v(62); // R62 costos
  const gastosAdminFiscal = v(63);
  const gastosVentasFiscal = v(64);
  const gastosNoOperFiscal = v(65);
  const gastosOtrosFiscal = v(66);

  const filasPyG: FilaPyG[] = [
    fila("ing_oper", "Ingresos operacionales", c.ingOperacionales41, ingOperFiscal),
    fila("ing_no_oper", "Ingresos no operacionales", c.ingNoOperacionales42, ingNoOperFiscal),
    fila("devol", "(−) Devoluciones y descuentos", c.devoluciones4175, devolucionesFiscal, true),
    filaTotal("total_ing", "TOTAL INGRESOS",
      c.ingOperacionales41 + c.ingNoOperacionales42 - c.devoluciones4175,
      ingOperFiscal + ingNoOperFiscal - devolucionesFiscal,
    ),
    fila("costo", "Costo de ventas", c.costoVenta6, costoVentaFiscal),
    fila("gas_admin", "Gastos de administración", c.gastosAdmin51, gastosAdminFiscal),
    fila("gas_vtas", "Gastos de ventas", c.gastosVentas52, gastosVentasFiscal),
    fila("gas_no_oper", "Gastos no operacionales", c.gastosNoOper53, gastosNoOperFiscal),
    fila("gas_otros", "Otros gastos y deducciones", c.gastosOtros54, gastosOtrosFiscal),
    filaTotal("total_costos", "TOTAL COSTOS Y GASTOS",
      c.costoVenta6 + c.gastosAdmin51 + c.gastosVentas52 + c.gastosNoOper53 + c.gastosOtros54,
      costoVentaFiscal + gastosAdminFiscal + gastosVentasFiscal + gastosNoOperFiscal + gastosOtrosFiscal,
    ),
  ];

  // Utilidad antes de impuestos contable y fiscal (cómo se reconstruye desde PyG)
  const totalIngContable = c.ingOperacionales41 + c.ingNoOperacionales42 - c.devoluciones4175;
  const totalCostosContable = c.costoVenta6 + c.gastosAdmin51 + c.gastosVentas52 +
    c.gastosNoOper53 + c.gastosOtros54;
  // utilidad pyg contable solo es informativa · la utilidad real viene del libro mayor
  // (declaracion.utilidad_contable − perdida_contable), no del SUMIF del balance.

  filasPyG.push(
    filaTotal("utilidad", "UTILIDAD ANTES DE IMPUESTOS",
      input.utilidadContableNeta,
      totalIngContable - totalCostosContable, // proxy fiscal del PyG (no aplica)
    ),
  );

  // Partidas de conciliación · ya vienen clasificadas
  const partidas = input.partidas;

  const subtotales = {
    temporariasDeducibles: sumarCategoria(partidas, "temporaria_deducible"),
    temporariasImponibles: sumarCategoria(partidas, "temporaria_imponible"),
    permanentes: sumarCategoria(partidas, "permanente"),
    netoTotal: 0,
  };
  // Fórmula NIC 12: las temporarias deducibles SUMAN a la utilidad fiscal
  // (porque el gasto contable no fue deducido en el año fiscal); las
  // imponibles RESTAN (porque el ingreso contable no es gravado aún).
  // Las permanentes pueden tener cualquier signo.
  subtotales.netoTotal =
    subtotales.temporariasDeducibles -
    subtotales.temporariasImponibles +
    subtotales.permanentes;

  const rentaLiquidaCalculada = input.utilidadContableNeta + subtotales.netoTotal;

  // Cuadres
  const r72 = v(72);
  const r75 = v(75);
  const r79 = v(79);

  function cuadre(real: number) {
    const dif = rentaLiquidaCalculada - real;
    return {
      real,
      calculada: rentaLiquidaCalculada,
      diferencia: dif,
      ok: Math.abs(dif) <= TOLERANCIA,
    };
  }

  const cuadres = {
    vsR72: cuadre(r72),
    vsR75: cuadre(r75),
    vsR79: cuadre(r79),
  };

  // Estado global · usa el cuadre vs R72 que es el más cercano al concepto
  // "renta líquida ordinaria". El estado considera tolerancia escalada.
  let estado: "cuadrado" | "descuadrado_leve" | "descuadrado";
  const dif72 = Math.abs(cuadres.vsR72.diferencia);
  if (dif72 <= TOLERANCIA) estado = "cuadrado";
  else if (dif72 <= Math.max(1000, Math.abs(input.utilidadContableNeta) * 0.001))
    estado = "descuadrado_leve";
  else estado = "descuadrado";

  return {
    filasPyG,
    utilidadContableTotal: input.utilidadContableNeta,
    utilidadFiscalTotal: input.utilidadContableNeta + subtotales.netoTotal,
    partidas,
    subtotales,
    rentaLiquidaCalculada,
    cuadres,
    estado,
  };
}

function fila(
  id: string,
  concepto: string,
  contable: number,
  fiscal: number,
  esResta = false,
): FilaPyG {
  return {
    id,
    concepto,
    contable,
    fiscal,
    diferencia: fiscal - contable,
    esResta,
  };
}

function filaTotal(
  id: string,
  concepto: string,
  contable: number,
  fiscal: number,
): FilaPyG {
  return {
    id,
    concepto,
    contable,
    fiscal,
    diferencia: fiscal - contable,
    esTotal: true,
  };
}
