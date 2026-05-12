// F2516 · Hoja 5 · Ingresos y Facturación
//
// Detalle de ingresos por concepto y tipo. Cada concepto se desglosa en
// 4 columnas: gravados, exentos, excluidos, exportación. La suma total
// se concilia contra la facturación electrónica DIAN y contra R47+R57
// del Form 110.

export type F2516H5Concepto = {
  id: string;
  concepto: string;
  ayuda: string;
};

/**
 * Conceptos oficiales DIAN del Formato 2516 H5 (modelo110.xlsm).
 *
 * 5 conceptos oficiales · cada uno con la matriz:
 *   Pasivo por ingreso diferido (val1-val4)
 *   Facturación emitida en el período (val5-val9)
 *   Ingreso contable devengado (val10-val12)
 *
 * Replica los SUMIF de la hoja oficial que toman de la H3 ERI los
 * ingresos brutos por categoría (venta bienes, servicios, otros).
 */
export const F2516_H5_CONCEPTOS: F2516H5Concepto[] = [
  {
    id: "VENTA_BIENES",
    concepto: "Venta de bienes",
    ayuda:
      "Ingresos por venta de bienes (R47 F110, clases PUC 4135/4140 ventas mercancía).",
  },
  {
    id: "PRESTACION_SERVICIOS",
    concepto: "Prestación de servicios",
    ayuda:
      "Servicios prestados (R47 parcial, clases PUC 4145-4170: financieros, inmobiliarios, sociales, salud, enseñanza, consultoría).",
  },
  {
    id: "OTROS_INGRESOS",
    concepto: "Otros ingresos",
    ayuda:
      "Ingresos diferentes a actividades ordinarias (R48/R57 F110): intereses, rendimientos, recuperaciones, diversos.",
  },
  {
    id: "INGRESOS_TERCEROS",
    concepto: "Ingresos para terceros",
    ayuda:
      "Ingresos recibidos por cuenta de terceros que no constituyen renta para el contribuyente · Art. 28-1 E.T.",
  },
  {
    id: "AJUSTES_FACTURADO",
    concepto: "Ajustes al valor facturado (descuentos, notas)",
    ayuda:
      "Notas crédito, descuentos comerciales, devoluciones · R59 F110. Se RESTAN del total.",
  },
];

export type F2516H5Captura = {
  declaracion_id: string;
  concepto_id: string;
  concepto: string;
  gravados: number;
  exentos: number;
  excluidos: number;
  exportacion: number;
  observacion: string | null;
};

export type F2516H5Conciliacion = {
  declaracion_id: string;
  total_facturado_dian: number;
  notas_credito_emitidas: number;
  notas_debito_emitidas: number;
  observacion: string | null;
};

export type F2516H5FilaCalculada = {
  concepto: F2516H5Concepto;
  gravados: number;
  exentos: number;
  excluidos: number;
  exportacion: number;
  total: number;
  observacion: string | null;
};

export type F2516H5Resumen = {
  filas: F2516H5FilaCalculada[];
  totalGravados: number;
  totalExentos: number;
  totalExcluidos: number;
  totalExportacion: number;
  granTotal: number;
  conciliacion: F2516H5Conciliacion | null;
  /** Ingresos brutos netos según H5 (granTotal − notas crédito + notas débito) */
  ingresosBrutosNetos: number;
};

export function computarH5(
  capturas: F2516H5Captura[],
  conciliacion: F2516H5Conciliacion | null,
): F2516H5Resumen {
  const byId = new Map<string, F2516H5Captura>();
  for (const c of capturas) byId.set(c.concepto_id, c);

  const filas: F2516H5FilaCalculada[] = F2516_H5_CONCEPTOS.map((cn) => {
    const c = byId.get(cn.id);
    const gravados = c?.gravados ?? 0;
    const exentos = c?.exentos ?? 0;
    const excluidos = c?.excluidos ?? 0;
    const exportacion = c?.exportacion ?? 0;
    return {
      concepto: cn,
      gravados,
      exentos,
      excluidos,
      exportacion,
      total: gravados + exentos + excluidos + exportacion,
      observacion: c?.observacion ?? null,
    };
  });

  const totalGravados = filas.reduce((s, f) => s + f.gravados, 0);
  const totalExentos = filas.reduce((s, f) => s + f.exentos, 0);
  const totalExcluidos = filas.reduce((s, f) => s + f.excluidos, 0);
  const totalExportacion = filas.reduce((s, f) => s + f.exportacion, 0);
  const granTotal =
    totalGravados + totalExentos + totalExcluidos + totalExportacion;

  const ncEmitidas = conciliacion?.notas_credito_emitidas ?? 0;
  const ndEmitidas = conciliacion?.notas_debito_emitidas ?? 0;
  const ingresosBrutosNetos = granTotal - ncEmitidas + ndEmitidas;

  return {
    filas,
    totalGravados,
    totalExentos,
    totalExcluidos,
    totalExportacion,
    granTotal,
    conciliacion,
    ingresosBrutosNetos,
  };
}
