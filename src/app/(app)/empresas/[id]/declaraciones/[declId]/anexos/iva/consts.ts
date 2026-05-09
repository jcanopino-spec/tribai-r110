// Anexo IVA · constantes y tipos
// Soporta los 2 regímenes de periodicidad del Art. 600 E.T.

export type Periodicidad = "bimestral" | "cuatrimestral";

export type State = { error: string | null; ok: boolean };

export const ESTADO_INICIAL: State = { error: null, ok: false };

export const PERIODICIDADES: Array<{
  id: Periodicidad;
  label: string;
  numPeriodos: number;
  descripcionPeriodo: (n: number) => string;
}> = [
  {
    id: "bimestral",
    label: "Bimestral",
    numPeriodos: 6,
    descripcionPeriodo: (n) => {
      const meses = [
        "Ene-Feb",
        "Mar-Abr",
        "May-Jun",
        "Jul-Ago",
        "Sep-Oct",
        "Nov-Dic",
      ];
      return meses[n - 1] ?? `Periodo ${n}`;
    },
  },
  {
    id: "cuatrimestral",
    label: "Cuatrimestral",
    numPeriodos: 3,
    descripcionPeriodo: (n) => {
      const cuatris = ["Ene-Abr", "May-Ago", "Sep-Dic"];
      return cuatris[n - 1] ?? `Periodo ${n}`;
    },
  },
];

export type IvaItem = {
  id: number;
  periodicidad: Periodicidad;
  periodo: number;
  fecha_presentacion: string | null;
  numero_formulario: string | null;
  ingresos_brutos: number;
  ingresos_no_gravados: number;
  ingresos_exentos: number;
  ingresos_gravados: number;
  iva_generado: number;
  iva_descontable: number;
  saldo_pagar: number;
  saldo_favor: number;
  pdf_path: string | null;
  pdf_filename: string | null;
  observacion: string | null;
};
