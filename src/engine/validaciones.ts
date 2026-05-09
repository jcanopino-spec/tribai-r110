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
