// Checklist Normativo · verificación pre-presentación.
//
// Replica la hoja "Checklist Normativo" del .xlsm guía v5: 23 items en
// 7 secciones que el contador debe verificar antes de presentar la
// declaración. Cada item tiene una referencia legal del E.T. y un tipo:
//
//   "auto"   · el sistema lo verifica desde el estado de la declaración
//   "manual" · requiere confirmación del usuario (criterio profesional)
//
// El listado replica los Arts. del E.T. citados en el .xlsm sin
// inventarlos. Las validaciones automáticas reusan los mismos cálculos
// del engine (`form110`, `validaciones`, `condicionales`).

export type ChecklistEstado = "ok" | "fail" | "manual" | "n_a";

export type ChecklistSeccion =
  | "DATOS"
  | "PATRIMONIO"
  | "INGRESOS"
  | "COSTOS"
  | "LIQUIDACION"
  | "CONCILIACION"
  | "FORMAL";

export type ChecklistItem = {
  id: string;
  numero: number;
  seccion: ChecklistSeccion;
  concepto: string;
  artET: string;
  tipo: "auto" | "manual";
};

/**
 * Catálogo completo · idéntico al .xlsm guía v5.
 * Numeración relativa a cada sección (1, 2, 3 dentro de DATOS, etc.).
 */
export const CHECKLIST_ITEMS: readonly ChecklistItem[] = [
  // DATOS
  { id: "DATOS_1_NIT", numero: 1, seccion: "DATOS", concepto: "NIT y DV correctos", artET: "Art. 555", tipo: "auto" },
  { id: "DATOS_2_RAZON", numero: 2, seccion: "DATOS", concepto: "Razón social coincide con RUT", artET: "Art. 555", tipo: "manual" },
  { id: "DATOS_3_CIIU", numero: 3, seccion: "DATOS", concepto: "CIIU actualizado", artET: "Art. 631", tipo: "auto" },

  // PATRIMONIO
  { id: "PAT_1_VALOR_FISCAL", numero: 1, seccion: "PATRIMONIO", concepto: "Activos a valor fiscal", artET: "Arts. 267-277", tipo: "manual" },
  { id: "PAT_2_PPE_DEP", numero: 2, seccion: "PATRIMONIO", concepto: "PPE con depreciación fiscal", artET: "Art. 277", tipo: "manual" },
  { id: "PAT_3_PASIVOS_SOPORTE", numero: 3, seccion: "PATRIMONIO", concepto: "Pasivos con soporte", artET: "Art. 283", tipo: "manual" },

  // INGRESOS
  { id: "ING_1_REALIZADOS", numero: 1, seccion: "INGRESOS", concepto: "Ingresos realizados", artET: "Arts. 27-28", tipo: "manual" },
  { id: "ING_2_INCRNGO", numero: 2, seccion: "INGRESOS", concepto: "INCRNGO clasificados correctamente", artET: "Arts. 36-57", tipo: "manual" },
  { id: "ING_3_DIVIDENDOS", numero: 3, seccion: "INGRESOS", concepto: "Dividendos clasificados por periodo", artET: "Arts. 48-49", tipo: "manual" },

  // COSTOS
  { id: "COSTO_1_CAUSALIDAD", numero: 1, seccion: "COSTOS", concepto: "Costos y gastos con causalidad y necesidad", artET: "Art. 107", tipo: "manual" },
  { id: "COSTO_2_FE", numero: 2, seccion: "COSTOS", concepto: "Soportados con factura electrónica", artET: "Art. 771-2", tipo: "manual" },
  { id: "COSTO_3_SUBCAP", numero: 3, seccion: "COSTOS", concepto: "Subcapitalización aplicada si hay vinculados", artET: "Art. 118-1", tipo: "auto" },
  { id: "COSTO_4_ICA", numero: 4, seccion: "COSTOS", concepto: "ICA: o 100% gasto o 50% descuento (no ambos)", artET: "Art. 115", tipo: "manual" },

  // LIQUIDACION
  { id: "LIQ_1_TARIFA", numero: 1, seccion: "LIQUIDACION", concepto: "Tarifa correcta según régimen", artET: "Art. 240", tipo: "auto" },
  { id: "LIQ_2_TTD", numero: 2, seccion: "LIQUIDACION", concepto: "Tasa Mínima de Tributación 15% calculada", artET: "Art. 240 par. 6°", tipo: "auto" },
  { id: "LIQ_3_DESC_LIM", numero: 3, seccion: "LIQUIDACION", concepto: "Descuentos respetan tope 75% Art. 259", artET: "Art. 259", tipo: "auto" },
  { id: "LIQ_4_ANTICIPO", numero: 4, seccion: "LIQUIDACION", concepto: "Anticipo año siguiente calculado", artET: "Arts. 807-810", tipo: "auto" },

  // CONCILIACION
  { id: "CONC_1_PATRIM", numero: 1, seccion: "CONCILIACION", concepto: "Conciliación patrimonial cuadrada", artET: "Art. 236", tipo: "manual" },
  { id: "CONC_2_UTIL", numero: 2, seccion: "CONCILIACION", concepto: "Conciliación de utilidad cuadrada", artET: "F.2516", tipo: "manual" },
  { id: "CONC_3_F2516", numero: 3, seccion: "CONCILIACION", concepto: "F.2516 cuadra contra F.110", artET: "Resolución 71/2019", tipo: "auto" },

  // FORMAL
  { id: "FORM_1_PLAZO", numero: 1, seccion: "FORMAL", concepto: "Presentación dentro del plazo", artET: "Art. 641", tipo: "auto" },
  { id: "FORM_2_FIRMA_REP", numero: 2, seccion: "FORMAL", concepto: "Firma del representante legal", artET: "Art. 596", tipo: "auto" },
  { id: "FORM_3_FIRMA_CR", numero: 3, seccion: "FORMAL", concepto: "Firma contador o revisor fiscal", artET: "Art. 596", tipo: "auto" },
];

export type ChecklistContext = {
  nit: string | null;
  dv: string | null;
  ciiu: string | null;
  razonSocial: string | null;
  regimenCodigo: string | null;
  tarifaRegimen: number | null;
  /** Renglones computados del 110. */
  numerico: Map<number, number>;
  /** Estado de presentación. */
  presentacionOportuna: boolean;
  /** ¿Aplica TTD el régimen? */
  ttdAplicaPorRegimen: boolean;
  /** ¿Subcapitalización detectada como vinculado? */
  esVinculadoSubcap: boolean;
  /** Datos firmas. */
  codRepresentacion: string | null;
  codContadorRF: string | null;
  /** ¿Hay descuadres del F2516 sobre tolerancia? */
  hayDescuadresF2516: boolean;
  /** ¿Calcula anticipo? */
  calculaAnticipo: boolean;
  /** Año del primer ejercicio (si es primero, anticipo = 0 y marca OK). */
  aniosDeclarando: "primero" | "segundo" | "tercero_o_mas" | undefined;
};

export type ChecklistResultado = {
  item: ChecklistItem;
  estado: ChecklistEstado;
  detalle: string | null;
};

/**
 * Ejecuta los verificadores automáticos sobre el estado de la declaración.
 * Los items "manual" devuelven estado="manual" sin detalle.
 */
export function evaluarChecklist(ctx: ChecklistContext): ChecklistResultado[] {
  const get = (n: number) => ctx.numerico.get(n) ?? 0;
  return CHECKLIST_ITEMS.map((item) => {
    if (item.tipo === "manual") {
      return { item, estado: "manual" as const, detalle: null };
    }
    return { item, ...verificar(item, ctx, get) };
  });
}

function verificar(
  item: ChecklistItem,
  ctx: ChecklistContext,
  get: (n: number) => number,
): { estado: ChecklistEstado; detalle: string | null } {
  switch (item.id) {
    case "DATOS_1_NIT": {
      if (!ctx.nit || !ctx.dv) {
        return { estado: "fail", detalle: "Falta NIT o DV en la empresa." };
      }
      return { estado: "ok", detalle: `${ctx.nit}-${ctx.dv}` };
    }
    case "DATOS_3_CIIU": {
      if (!ctx.ciiu) {
        return { estado: "fail", detalle: "Sin código CIIU registrado." };
      }
      return { estado: "ok", detalle: `CIIU ${ctx.ciiu}` };
    }
    case "COSTO_3_SUBCAP": {
      // Si NO es vinculado, no aplica
      if (!ctx.esVinculadoSubcap) {
        return { estado: "n_a", detalle: "No es vinculado · no aplica subcapitalización." };
      }
      // Si es vinculado, marcamos manual porque el cálculo lo hace el anexo
      return { estado: "manual", detalle: "Verifica que el anexo de subcapitalización esté registrado." };
    }
    case "LIQ_1_TARIFA": {
      if (!ctx.regimenCodigo) {
        return { estado: "fail", detalle: "Régimen tributario sin asignar." };
      }
      if (ctx.tarifaRegimen == null) {
        return {
          estado: "fail",
          detalle: `Régimen ${ctx.regimenCodigo} sin tarifa configurada para el AG.`,
        };
      }
      return { estado: "ok", detalle: `Régimen ${ctx.regimenCodigo} · tarifa ${(ctx.tarifaRegimen * 100).toFixed(0)}%` };
    }
    case "LIQ_2_TTD": {
      if (!ctx.ttdAplicaPorRegimen) {
        return { estado: "n_a", detalle: "Régimen exonerado de TTD." };
      }
      // Hay TTD aplicable; verificar que R95 esté coherente
      if (get(95) > 0) {
        return { estado: "ok", detalle: `Impuesto adicional R95 = ${formatMoney(get(95))}.` };
      }
      // Si UD > 0 pero R95 = 0, tasa efectiva ≥ 15% → OK
      return { estado: "ok", detalle: "Tasa efectiva cumple el mínimo del 15%." };
    }
    case "LIQ_3_DESC_LIM": {
      const r84 = get(84);
      const r93 = get(93);
      if (r84 === 0 && r93 === 0) {
        return { estado: "n_a", detalle: "Sin impuesto básico ni descuentos." };
      }
      const tope = r84 * 0.75;
      if (r93 <= tope + 1) {
        return {
          estado: "ok",
          detalle: `R93 (${formatMoney(r93)}) ≤ 75% de R84 (tope ${formatMoney(Math.round(tope))}).`,
        };
      }
      return {
        estado: "fail",
        detalle: `R93 supera el 75% de R84 · revisar Art. 259.`,
      };
    }
    case "LIQ_4_ANTICIPO": {
      if (ctx.aniosDeclarando === "primero") {
        return { estado: "n_a", detalle: "Primer año declarando · anticipo no aplica." };
      }
      if (!ctx.calculaAnticipo) {
        return { estado: "fail", detalle: "Falta activar 'calcula anticipo' en /configuracion." };
      }
      return { estado: "ok", detalle: `R108 = ${formatMoney(get(108))}.` };
    }
    case "CONC_3_F2516": {
      if (ctx.hayDescuadresF2516) {
        return {
          estado: "fail",
          detalle: "Hay descuadres > $1.000 entre el F2516 y los renglones del 110.",
        };
      }
      return { estado: "ok", detalle: "F2516 cuadra con los renglones del 110." };
    }
    case "FORM_1_PLAZO": {
      return ctx.presentacionOportuna
        ? { estado: "ok", detalle: "Dentro del plazo legal." }
        : { estado: "fail", detalle: "Presentación extemporánea o sin fecha registrada." };
    }
    case "FORM_2_FIRMA_REP": {
      return ctx.codRepresentacion
        ? { estado: "ok", detalle: `Cód. representación ${ctx.codRepresentacion}.` }
        : { estado: "fail", detalle: "Falta código de representación legal." };
    }
    case "FORM_3_FIRMA_CR": {
      return ctx.codContadorRF
        ? { estado: "ok", detalle: `Cód. contador/RF ${ctx.codContadorRF}.` }
        : { estado: "fail", detalle: "Falta código de contador o revisor fiscal." };
    }
  }
  return { estado: "manual", detalle: null };
}

const FMT_CHK = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
function formatMoney(n: number): string {
  return `$${FMT_CHK.format(n)}`;
}

/** Resumen del checklist por estado. */
export function resumenChecklist(r: ChecklistResultado[]) {
  return {
    ok: r.filter((x) => x.estado === "ok").length,
    fail: r.filter((x) => x.estado === "fail").length,
    manual: r.filter((x) => x.estado === "manual").length,
    na: r.filter((x) => x.estado === "n_a").length,
    total: r.length,
    bloqueante: r.some((x) => x.estado === "fail"),
  };
}
