// Tasa Mínima de Tributación Depurada (TTD) · Art. 240 par. 6° E.T.
//
// Ley 2277 de 2022 introdujo la TTD: las personas jurídicas (régimen
// ordinario) deben pagar un impuesto efectivo mínimo del 15% sobre la
// "Utilidad Depurada" (UD). Si la TTD calculada está por debajo del 15%,
// el contribuyente debe ADICIONAR al impuesto la diferencia. La adición
// va en el R95 del Formulario 110 (Impuesto a Adicionar · IA).
//
// Fórmula oficial DIAN (extraída del Liquidador AG 2025, hoja "Tasa
// Mínima - TTD"):
//
//   TTD = ID / UD
//
//   ID  (Impuesto Depurado)  = INR + DTC − IRP, forzado ≥ 0
//   UD  (Utilidad Depurada)  = UC + DPARL − INCRNGO − VIMPP − VNGO − RE − C, forzado ≥ 0
//
//   Componentes:
//     INR    = R94 Impuesto Neto de Renta
//     DTC    = R92 (Valor Adicional VAA) + R93 (Descuentos tributarios sujetos al límite)
//     IRP    = Impuesto sobre Rentas Pasivas (R71 × tarifa especial); 0 si no aplica ECE
//     UC     = Utilidad Contable antes de impuestos (declaracion.utilidad_contable
//              − declaracion.perdida_contable)
//     DPARL  = Σ diferencias permanentes que aumentan la renta líquida (Anexo 17
//              filas 158-190 del .xlsm). En la app, viene de las partidas
//              `tipo='permanente'` `signo='mas'` de la conciliación de utilidad.
//     INCRNGO = R60 del 110 (suma del Anexo 26)
//     VIMPP  = Valor Ingreso Método de Participación Patrimonial (manual, 0 si no aplica)
//     VNGO   = R83 ganancia ocasional gravable
//     RE     = R77 rentas exentas (sólo las sujetas al límite por tratados/CAN/etc.)
//     C      = R74 compensaciones de pérdidas o excesos de RP
//
//   Si TTD < 15% → IA = max(0, UD × 15% − ID)
//   Si TTD ≥ 15% → IA = 0 (no hay nada que adicionar)
//   Si UD ≤ 0    → IA = 0 (sin base no hay obligación)
//
// Excepciones (NO aplica TTD):
//   - Personas jurídicas extranjeras sin residencia
//   - Empresas en zonas francas (regímenes 03, 04, 05)
//   - Empresas con utilidad depurada ≤ 0
//   - El usuario puede desactivar manualmente con `aplica_tasa_minima=false`

/** Tasa mínima de tributación depurada · Ley 2277/2022 */
export const TASA_MINIMA = 0.15;

export type TasaMinimaInputs = {
  /** R94 · Impuesto Neto de Renta */
  inr: number;
  /** R92 · Valor Adicional VAA */
  vaa: number;
  /** R93 · Descuentos Tributarios sujetos al límite */
  descuentosTributarios: number;
  /** Impuesto sobre Rentas Pasivas (ECE). Por defecto 0. */
  impuestoRentasPasivas?: number;
  /** Utilidad contable antes de impuestos (utilidad_contable − perdida_contable) */
  utilidadContable: number;
  /** Σ diferencias permanentes que aumentan la renta (de la conciliación de utilidad) */
  difPermanentesAumentan: number;
  /** R60 · INCRNGO */
  incrngo: number;
  /** Valor ingreso método de participación patrimonial (manual). Default 0. */
  vimpp?: number;
  /** R83 · Ganancia ocasional gravable */
  gananciaOcasionalGravable: number;
  /** R77 · Rentas exentas */
  rentasExentas: number;
  /** R74 · Compensaciones */
  compensaciones: number;
};

export type TasaMinimaResult = {
  /** Impuesto Depurado · ID = max(0, INR + DTC − IRP) */
  id: number;
  /** Utilidad Depurada · UD = max(0, UC + DPARL − INCRNGO − VIMPP − VNGO − RE − C) */
  ud: number;
  /** Tasa de Tributación Depurada · TTD = ID / UD (null si UD ≤ 0) */
  ttd: number | null;
  /** Impuesto a Adicionar · IA. Va al R95 del 110. */
  ia: number;
};

/**
 * Calcula los componentes de la Tasa Mínima de Tributación según la
 * fórmula oficial DIAN del Anexo "Tasa Mínima - TTD" del Liquidador 2025.
 *
 * Si `aplica = false` (zona franca, no residente, etc.), retorna ceros.
 * Si la UD ≤ 0, retorna IA=0 (no hay base sobre la cual exigir el mínimo).
 * Si la TTD ≥ 15%, retorna IA=0 (la empresa ya cumple).
 * Si la TTD < 15%, retorna IA = UD × 15% − ID.
 */
export function calcularTasaMinima(
  args: TasaMinimaInputs & { aplica: boolean },
): TasaMinimaResult {
  if (!args.aplica) {
    return { id: 0, ud: 0, ttd: null, ia: 0 };
  }

  // ID · Impuesto Depurado
  const dtc = args.vaa + args.descuentosTributarios;
  const irp = args.impuestoRentasPasivas ?? 0;
  const id = Math.max(0, args.inr + dtc - irp);

  // UD · Utilidad Depurada
  const ud = Math.max(
    0,
    args.utilidadContable +
      args.difPermanentesAumentan -
      args.incrngo -
      (args.vimpp ?? 0) -
      args.gananciaOcasionalGravable -
      args.rentasExentas -
      args.compensaciones,
  );

  if (ud <= 0) {
    return { id, ud: 0, ttd: null, ia: 0 };
  }

  const ttd = id / ud;
  if (ttd >= TASA_MINIMA) {
    return { id, ud, ttd, ia: 0 };
  }

  const ia = Math.max(0, ud * TASA_MINIMA - id);
  return { id, ud, ttd, ia };
}

/**
 * Atajo: solo el IA (Impuesto a Adicionar). Útil para integrar en
 * computarRenglones donde solo necesitamos el valor que va al R95.
 */
export function calcularImpuestoAdicionar(
  args: TasaMinimaInputs & { aplica: boolean },
): number {
  return calcularTasaMinima(args).ia;
}
