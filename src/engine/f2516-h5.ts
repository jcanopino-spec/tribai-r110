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

export const F2516_H5_CONCEPTOS: F2516H5Concepto[] = [
  {
    id: "VENTAS_BIENES_NAC",
    concepto: "Ventas de bienes nacionales",
    ayuda: "Ingresos por venta de mercancía en el territorio nacional.",
  },
  {
    id: "VENTAS_COMERCIALIZ",
    concepto: "Ventas a sociedades de comercialización internacional",
    ayuda: "Ventas a SCI · Decreto 380/2012.",
  },
  {
    id: "SERVICIOS_NAC",
    concepto: "Servicios prestados nacionales",
    ayuda: "Honorarios, comisiones, servicios técnicos en territorio nacional.",
  },
  {
    id: "SERVICIOS_EXP",
    concepto: "Servicios prestados al exterior (exportación)",
    ayuda: "Servicios facturados a clientes del exterior · Art. 481 E.T.",
  },
  {
    id: "COMISIONES",
    concepto: "Comisiones",
    ayuda: "Comisiones por intermediación.",
  },
  {
    id: "HONORARIOS",
    concepto: "Honorarios profesionales",
    ayuda: "Honorarios distintos a servicios técnicos.",
  },
  {
    id: "ARRENDAMIENTOS",
    concepto: "Arrendamientos",
    ayuda: "Cánones de arrendamiento de bienes muebles e inmuebles.",
  },
  {
    id: "RECUPERACIONES",
    concepto: "Recuperaciones e indemnizaciones",
    ayuda:
      "Recuperación de provisiones, deterioros, costos · Art. 195 E.T.",
  },
  {
    id: "INTERESES",
    concepto: "Ingresos por intereses (financieros)",
    ayuda: "Intereses, rendimientos de inversiones.",
  },
  {
    id: "DIVERSOS",
    concepto: "Otros ingresos diversos",
    ayuda: "Ingresos no clasificables en categorías anteriores.",
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
