// Validaciones del Formulario 110.
// Recibe el mapa numérico ya computado y devuelve una lista de hallazgos
// (errores bloqueantes, advertencias, info) que se muestran al usuario en
// /validaciones y se usan para gatear la finalización de la declaración.

import { evaluarBeneficioAuditoria } from "./beneficio-auditoria";
import type { F2516Fila } from "./f2516";

export type Validacion = {
  nivel: "info" | "warn" | "error";
  renglon?: number;
  mensaje: string;
  categoria: "configuracion" | "cuadre" | "sanidad" | "completitud" | "fiscal" | "f2516";
};

/**
 * Tolerancia aceptable para el cuadre F2516 ↔ F110.
 * El Liquidador oficial DIAN trabaja en múltiplos de 1.000 (redondeo DIAN),
 * así que diferencias menores son ruido de redondeo.
 */
export const TOLERANCIA_CUADRE = 1000;

export function validarFormulario(
  numerico: Map<number, number>,
  ctx: {
    tarifaRegimen?: number | null;
    regimenCodigo?: string | null;
    impuestoNetoAnterior?: number;
    aniosDeclarando?: string;
    presentacion?: { estado: "no_presentada" | "oportuna" | "extemporanea"; mesesExtemporanea?: number };
    calculaSancionExtemporaneidad?: boolean;
    aplicaTasaMinima?: boolean;
    beneficioAuditoria12m?: boolean;
    beneficioAuditoria6m?: boolean;
  } = {},
): Validacion[] {
  const get = (n: number) => numerico.get(n) ?? 0;
  const out: Validacion[] = [];

  // Configuración
  if (ctx.tarifaRegimen == null) {
    out.push({
      categoria: "configuracion",
      nivel: "error",
      mensaje: "Esta empresa no tiene régimen tributario configurado. El renglón 84 quedará en 0.",
    });
  }

  // ESAL · R68/R69 son inversiones específicas del Régimen Tributario Especial
  // (Art. 357 E.T.). Si el régimen NO es 08 y hay valores, es probable error.
  const esEsal = String(ctx.regimenCodigo ?? "").padStart(2, "0") === "08";
  if (!esEsal && (get(68) > 0 || get(69) > 0)) {
    out.push({
      categoria: "fiscal",
      nivel: "warn",
      renglon: 68,
      mensaje:
        "R68/R69 son inversiones del Régimen Tributario Especial (ESAL, Art. 357 E.T.). " +
        "Esta empresa NO está configurada como régimen 08 pero tiene valores en R68/R69. " +
        "Revisa que estén bien clasificadas; en régimen ordinario suelen ir como gastos en R62-R66.",
    });
  }

  // Cuadre patrimonial
  if (get(44) < get(45)) {
    out.push({
      categoria: "cuadre",
      nivel: "warn",
      renglon: 46,
      mensaje: "Patrimonio bruto (44) es menor que pasivos (45). El patrimonio líquido queda en 0.",
    });
  }

  if (get(44) === 0 && get(45) === 0) {
    out.push({
      categoria: "completitud",
      nivel: "warn",
      renglon: 44,
      mensaje: "No tienes patrimonio bruto ni pasivos. Verifica el balance importado.",
    });
  }

  // Cuadre operativo (ingresos / costos / renta)
  if (get(67) > get(58) && get(58) > 0) {
    out.push({
      categoria: "sanidad",
      nivel: "info",
      renglon: 73,
      mensaje:
        "Los costos (67) superan los ingresos brutos (58). Probablemente hay pérdida líquida.",
    });
  }

  if (get(73) > 0) {
    out.push({
      categoria: "fiscal",
      nivel: "info",
      renglon: 73,
      mensaje:
        "Tienes pérdida líquida del ejercicio. Puedes compensar contra futuras rentas líquidas vía renglón 74.",
    });
  }

  if (get(72) > 0 && get(74) > get(72)) {
    out.push({
      categoria: "fiscal",
      nivel: "warn",
      renglon: 74,
      mensaje:
        "Compensaciones (74) superan la renta líquida (72). Solo se compensa hasta el monto disponible.",
    });
  }

  // Renta exenta no puede superar renta líquida
  if (get(77) > Math.max(get(75), get(76))) {
    out.push({
      categoria: "fiscal",
      nivel: "error",
      renglon: 77,
      mensaje:
        "Renta exenta (77) supera el mayor entre renta líquida (75) y presuntiva (76). Verifica.",
    });
  }

  // Devoluciones razonables vs ingresos
  if (get(59) > get(58)) {
    out.push({
      categoria: "sanidad",
      nivel: "warn",
      renglon: 59,
      mensaje:
        "Devoluciones, rebajas y descuentos (59) superan los ingresos brutos (58). Verifica el signo y los datos.",
    });
  }

  // INCRNGO razonable vs ingresos
  if (get(60) > get(58)) {
    out.push({
      categoria: "sanidad",
      nivel: "warn",
      renglon: 60,
      mensaje:
        "Ingresos no constitutivos (60) superan los ingresos brutos (58). Verifica el dato.",
    });
  }

  // Sin renta gravable
  if (get(79) === 0 && get(76) === 0 && get(72) === 0) {
    out.push({
      categoria: "completitud",
      nivel: "info",
      renglon: 79,
      mensaje: "No hay renta líquida gravable. El impuesto será 0.",
    });
  }

  // Renta gravable sin tarifa
  if (get(79) > 0 && (ctx.tarifaRegimen ?? 0) === 0) {
    out.push({
      categoria: "configuracion",
      nivel: "error",
      renglon: 84,
      mensaje:
        "Hay renta líquida gravable pero la tarifa del régimen es 0. Configura el régimen de la empresa.",
    });
  }

  // Descuentos > impuesto bruto (91 + 92 = base de la fórmula 94 = 91+92-93)
  if (get(93) > get(91) + get(92)) {
    out.push({
      categoria: "fiscal",
      nivel: "error",
      renglon: 93,
      mensaje:
        "Descuentos tributarios (93) superan el impuesto bruto (91 + 92). El impuesto neto no puede ser negativo.",
    });
  }

  // Ganancias ocasionales
  if (get(83) > 0 && get(97) === 0) {
    out.push({
      categoria: "completitud",
      nivel: "info",
      renglon: 97,
      mensaje:
        "Tienes ganancias ocasionales gravables (83) pero el impuesto GO (97) es 0. Verifica el cálculo.",
    });
  }

  // Impuesto a cargo sin retenciones / anticipos
  if (get(99) > 0 && get(107) === 0 && get(103) === 0 && get(104) === 0) {
    out.push({
      categoria: "completitud",
      nivel: "info",
      renglon: 111,
      mensaje:
        "Tienes impuesto a cargo pero no registras retenciones, anticipos ni saldo a favor. Verifica antes de cerrar.",
    });
  }

  // Anticipo
  if (
    ctx.aniosDeclarando &&
    ctx.aniosDeclarando !== "primero" &&
    (ctx.impuestoNetoAnterior ?? 0) === 0
  ) {
    out.push({
      categoria: "completitud",
      nivel: "warn",
      renglon: 108,
      mensaje:
        "El impuesto neto del año gravable anterior está en 0. El anticipo (R108) se calcula sólo sobre el impuesto actual × tarifa según años declarando; verifica si es correcto.",
    });
  }

  // Anticipo año siguiente sospechosamente alto
  if (get(108) > get(99) * 2) {
    out.push({
      categoria: "sanidad",
      nivel: "warn",
      renglon: 108,
      mensaje:
        "El anticipo del año siguiente (108) es más del doble del impuesto a cargo (99). Verifica los inputs.",
    });
  }

  // Saldo positivo y a favor a la vez (imposible)
  if (get(113) > 0 && get(114) > 0) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      mensaje: "Hay simultáneamente saldo a pagar y saldo a favor. Es imposible; revisa los datos.",
    });
  }

  // Vencimiento / extemporaneidad
  if (ctx.presentacion?.estado === "extemporanea") {
    const meses = ctx.presentacion.mesesExtemporanea ?? 0;
    if (!ctx.calculaSancionExtemporaneidad) {
      out.push({
        categoria: "fiscal",
        nivel: "error",
        mensaje:
          `La declaración se presentó ${meses} mes${meses !== 1 ? "es" : ""} después del vencimiento. ` +
          "Activa 'Calcular sanción por extemporaneidad' en /configuracion para liquidar la sanción correspondiente.",
      });
    } else {
      out.push({
        categoria: "fiscal",
        nivel: "warn",
        mensaje:
          `Declaración extemporánea: ${meses} mes${meses !== 1 ? "es" : ""} de retraso. La sanción del Art. 641 E.T. se calcula sobre el impuesto a cargo o ingresos brutos.`,
      });
    }
  }

  if (ctx.presentacion?.estado === "no_presentada") {
    out.push({
      categoria: "completitud",
      nivel: "info",
      mensaje:
        "Sin fecha de presentación registrada. Configúrala en /configuracion (tab Sanciones) para evaluar oportunidad.",
    });
  }

  // Tasa Mínima de Tributación Depurada (Art. 240 par. 6° E.T.)
  // Si está desactivada y la tasa efectiva en R79 es menor al 15%,
  // avisar al usuario porque podría haber subpago si la empresa no
  // está realmente exenta (zona franca, no residente, etc.).
  if (ctx.aplicaTasaMinima === false && get(79) > 0) {
    const ttdEfectiva = get(94) / get(79);
    if (ttdEfectiva < 0.15) {
      out.push({
        categoria: "fiscal",
        nivel: "warn",
        renglon: 95,
        mensaje:
          `Tasa Mínima de Tributación (TTD) está DESACTIVADA pero la tasa efectiva sobre R79 es ${(ttdEfectiva * 100).toFixed(2)}%, menor al 15% requerido por Art. 240 par. 6° E.T. ` +
          "Verifica que la empresa realmente esté exonerada (zona franca, no residente, etc.); si no, reactiva el flag en /configuracion para que se calcule el Impuesto a Adicionar (R95) correctamente.",
      });
    }
  }

  // Beneficio de auditoría
  if (ctx.beneficioAuditoria12m || ctx.beneficioAuditoria6m) {
    const ben = evaluarBeneficioAuditoria({
      impuestoNetoActual: get(96),
      impuestoNetoAnterior: ctx.impuestoNetoAnterior ?? 0,
      pidio12m: !!ctx.beneficioAuditoria12m,
      pidio6m: !!ctx.beneficioAuditoria6m,
      presentacionOportuna: ctx.presentacion?.estado === "oportuna",
    });
    if (ben.cumpleRequisitos) {
      out.push({
        categoria: "fiscal",
        nivel: "info",
        mensaje:
          `Beneficio de auditoría aplicable: firmeza de ${ben.mesesFirmeza} meses ` +
          `(incremento del impuesto neto del ${(ben.incremento * 100).toFixed(2)}% vs AG anterior).`,
      });
    } else {
      out.push({
        categoria: "fiscal",
        nivel: "warn",
        mensaje:
          `Beneficio de auditoría no cumple los requisitos del Art. 689-3 E.T. ` +
          `${ben.razon ?? ""} La firmeza será la ordinaria (3 años).`,
      });
    }
  }

  return out;
}

/**
 * Valida cuadre del Formato 2516 (Resolución DIAN 71/2019) contra los
 * renglones equivalentes del Formulario 110.
 *
 * Para cada fila del F2516 con `cuadraConR110`, compara el FISCAL contra
 * el valor del renglón. Si |Δ| > TOLERANCIA_CUADRE genera un hallazgo:
 *   - error  · cuando es un total estructural (TOTAL ACTIVOS, R44/R46)
 *              que indica que el balance no concilia con la declaración
 *   - warn   · cuando es una fila individual descuadrada (R58, R67, etc.)
 *
 * Si NO hay balance cargado → emite info diciendo que F2516 va vacío.
 */
export function validarF2516(
  filas: ReadonlyArray<{
    fila: F2516Fila;
    contable: number;
    fiscal: number;
    r110: number | null;
    diferencia: number | null;
  }>,
): Validacion[] {
  const out: Validacion[] = [];

  // Si TODOS los contables están en 0 → balance no cargado o sin clasificar
  const todoEnCero = filas.every((f) => f.contable === 0);
  if (todoEnCero) {
    out.push({
      categoria: "f2516",
      nivel: "info",
      mensaje:
        "El Formato 2516 no tiene saldos contables: aún no has cargado el balance " +
        "o las cuentas no tienen prefijo PUC reconocible. Sube el balance para que " +
        "ESF + ERI se llenen automáticamente.",
    });
    return out;
  }

  for (const f of filas) {
    if (!f.fila.cuadraConR110 || f.diferencia === null) continue;
    if (Math.abs(f.diferencia) <= TOLERANCIA_CUADRE) continue;

    const esTotalEstructural =
      f.fila.id === "ESF_09_TOTAL_ACT" ||
      f.fila.id === "ESF_10_PASIVOS" ||
      f.fila.id === "PAT_11_LIQUIDO";

    out.push({
      categoria: "f2516",
      nivel: esTotalEstructural ? "error" : "warn",
      renglon: f.fila.cuadraConR110,
      mensaje:
        `F2516 fila ${f.fila.numero} "${f.fila.label}" no cuadra con R${f.fila.cuadraConR110}: ` +
        `fiscal ${formatMoney(f.fiscal)} vs renglón ${formatMoney(f.r110 ?? 0)} ` +
        `(Δ ${formatMoney(f.diferencia)}). ` +
        (esTotalEstructural
          ? "Es un total estructural; revisa los ajustes de las filas hijas."
          : "Captura conversión / menor / mayor fiscal en /conciliaciones/formato-2516."),
    });
  }

  return out;
}

/**
 * Validaciones cruzadas V1-V18 oficiales del .xlsm guía v5.
 *
 * Verifican coherencia interna del F110 (sumas, fórmulas, topes) y
 * cruces entre el F110 y los anexos. La numeración V1..V18 sigue el
 * orden del .xlsm para trazabilidad. V19-V22 (cuadre con BP) están
 * cubiertas por validarF2516.
 *
 * Cada validación devuelve una Validacion con:
 *   - categoría "cuadre" si es interno del F110
 *   - categoría "fiscal" si es contra topes legales
 *   - nivel "warn" para descuadres tolerables, "error" para topes legales
 */
export function validarCuadresF110(
  numerico: Map<number, number>,
  ctx: {
    totalAutorretenciones?: number;
    totalRetenciones?: number;
    totalDescuentosTributarios?: number;
    totalRentasExentas?: number;
    totalCompensaciones?: number;
    perdidasAcumuladas?: number;
  } = {},
): Validacion[] {
  const get = (n: number) => numerico.get(n) ?? 0;
  const out: Validacion[] = [];

  // V1 · R77 Rentas exentas anexo vs F110
  if (typeof ctx.totalRentasExentas === "number") {
    const dif = ctx.totalRentasExentas - get(77);
    if (Math.abs(dif) > TOLERANCIA_CUADRE) {
      out.push({
        categoria: "cuadre",
        nivel: "warn",
        renglon: 77,
        mensaje: `V1 · Rentas exentas Anexo 19 (${formatMoney(ctx.totalRentasExentas)}) no cuadra con R77 del 110 (${formatMoney(get(77))}).`,
      });
    }
  }

  // V2 · R107 Total retenciones (anexo) vs F110
  if (
    typeof ctx.totalAutorretenciones === "number" &&
    typeof ctx.totalRetenciones === "number"
  ) {
    const totalAnexo = ctx.totalAutorretenciones + ctx.totalRetenciones;
    const dif = totalAnexo - get(107);
    if (Math.abs(dif) > TOLERANCIA_CUADRE) {
      out.push({
        categoria: "cuadre",
        nivel: "warn",
        renglon: 107,
        mensaje: `V2 · Anexo 3 retenciones+autorretenciones (${formatMoney(totalAnexo)}) no cuadra con R107 (${formatMoney(get(107))}).`,
      });
    }
  }

  // V7 · Patrimonio líquido: R44 - R45 vs R46
  const r46Calc = Math.max(0, get(44) - get(45));
  if (Math.abs(r46Calc - get(46)) > TOLERANCIA_CUADRE) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      renglon: 46,
      mensaje: `V7 · R46 esperado ${formatMoney(r46Calc)} (R44-R45), declarado ${formatMoney(get(46))}.`,
    });
  }

  // V8 · Ingresos netos: R58 - R59 - R60 vs R61
  const r61Calc = Math.max(0, get(58) - get(59) - get(60));
  if (Math.abs(r61Calc - get(61)) > TOLERANCIA_CUADRE) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      renglon: 61,
      mensaje: `V8 · R61 esperado ${formatMoney(r61Calc)} (R58-R59-R60), declarado ${formatMoney(get(61))}.`,
    });
  }

  // V9 · Total costos: sum(R62..R66) vs R67
  let r67Calc = 0;
  for (let n = 62; n <= 66; n++) r67Calc += get(n);
  if (Math.abs(r67Calc - get(67)) > TOLERANCIA_CUADRE) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      renglon: 67,
      mensaje: `V9 · R67 esperado ${formatMoney(r67Calc)} (suma 62..66), declarado ${formatMoney(get(67))}.`,
    });
  }

  // V10 · Total retenciones: R105 + R106 vs R107
  const r107Calc = get(105) + get(106);
  if (Math.abs(r107Calc - get(107)) > TOLERANCIA_CUADRE) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      renglon: 107,
      mensaje: `V10 · R107 esperado ${formatMoney(r107Calc)} (R105+R106), declarado ${formatMoney(get(107))}.`,
    });
  }

  // V11 · Impuesto neto: max(0, R91 + R92 - R93) vs R94
  const r94Calc = Math.max(0, get(91) + get(92) - get(93));
  if (Math.abs(r94Calc - get(94)) > TOLERANCIA_CUADRE) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      renglon: 94,
      mensaje: `V11 · R94 esperado ${formatMoney(r94Calc)} (R91+R92-R93), declarado ${formatMoney(get(94))}.`,
    });
  }

  // V12 · Renta líquida gravable: max(R75, R76) - R77 + R78 vs R79
  const r79Calc = Math.max(get(75), get(76)) - get(77) + get(78);
  if (Math.abs(r79Calc - get(79)) > TOLERANCIA_CUADRE) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      renglon: 79,
      mensaje: `V12 · R79 esperado ${formatMoney(r79Calc)} (max(R75,R76)-R77+R78), declarado ${formatMoney(get(79))}.`,
    });
  }

  // V14 · Descuentos tributarios ≤ 75% R84 (Art. 259 E.T.)
  const tope259 = Math.max(0, get(84)) * 0.75;
  if (get(93) > tope259 + TOLERANCIA_CUADRE) {
    out.push({
      categoria: "fiscal",
      nivel: "error",
      renglon: 93,
      mensaje: `V14 · R93 (${formatMoney(get(93))}) supera el tope del 75% del R84 (${formatMoney(Math.round(tope259))}) · Art. 259 E.T.`,
    });
  }

  // V16 · Compensación de pérdidas no excede saldo acumulado
  if (
    typeof ctx.perdidasAcumuladas === "number" &&
    get(74) > ctx.perdidasAcumuladas + TOLERANCIA_CUADRE
  ) {
    out.push({
      categoria: "fiscal",
      nivel: "error",
      renglon: 74,
      mensaje: `V16 · R74 compensación (${formatMoney(get(74))}) supera el saldo acumulado de pérdidas (${formatMoney(ctx.perdidasAcumuladas)}).`,
    });
  }

  // V18 · Suma R49..R56 dividendos · cruce de coherencia interna
  let sumDiv = 0;
  for (let n = 49; n <= 56; n++) sumDiv += get(n);
  if (sumDiv > 0 && get(58) < sumDiv) {
    out.push({
      categoria: "cuadre",
      nivel: "warn",
      renglon: 58,
      mensaje: `V18 · R58 ingresos brutos (${formatMoney(get(58))}) es menor que la suma de dividendos R49..R56 (${formatMoney(sumDiv)}).`,
    });
  }

  // V cuadre · R99 = max(0, R96 + R97 - R98)
  const r99Calc = Math.max(0, get(96) + get(97) - get(98));
  if (Math.abs(r99Calc - get(99)) > TOLERANCIA_CUADRE) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      renglon: 99,
      mensaje: `R99 esperado ${formatMoney(r99Calc)} (R96+R97-R98), declarado ${formatMoney(get(99))}.`,
    });
  }

  // V cuadre · R96 = R94 + R95
  const r96Calc = get(94) + get(95);
  if (Math.abs(r96Calc - get(96)) > TOLERANCIA_CUADRE) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      renglon: 96,
      mensaje: `R96 esperado ${formatMoney(r96Calc)} (R94+R95), declarado ${formatMoney(get(96))}.`,
    });
  }

  // V cuadre · R91 = sum(R84..R90)
  let r91Calc = 0;
  for (let n = 84; n <= 90; n++) r91Calc += get(n);
  if (Math.abs(r91Calc - get(91)) > TOLERANCIA_CUADRE) {
    out.push({
      categoria: "cuadre",
      nivel: "error",
      renglon: 91,
      mensaje: `R91 esperado ${formatMoney(r91Calc)} (suma R84..R90), declarado ${formatMoney(get(91))}.`,
    });
  }

  return out;
}

const FMT_VAL = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
function formatMoney(n: number): string {
  return `$${FMT_VAL.format(n)}`;
}

/**
 * Resumen de validaciones por nivel.
 */
export function resumenValidaciones(v: Validacion[]) {
  return {
    errores: v.filter((x) => x.nivel === "error").length,
    advertencias: v.filter((x) => x.nivel === "warn").length,
    informativas: v.filter((x) => x.nivel === "info").length,
    bloqueante: v.some((x) => x.nivel === "error"),
  };
}
