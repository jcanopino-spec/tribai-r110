// Conciliación Fiscal · Utilidad contable → Renta líquida fiscal
//
// Conceptos extraídos del Liquidador DIAN AG 2025 (estructura Anexo 17):
// diferencias permanentes (no se revierten) y temporales (generan
// impuesto diferido, NIC 12 / Sección 29 NIIF).

export type State = { error: string | null; ok: boolean };
export type Tipo = "permanente" | "temporal";
export type Signo = "mas" | "menos";

// ============================================================
// DIFERENCIAS PERMANENTES
// ============================================================

// Que SUMAN a la renta líquida (gastos no deducibles, ingresos no contables
// que sí son fiscales). Cubre los conceptos R157-R190 del Anexo 17 oficial.
export const CONCEPTOS_PERMANENTES_MAS = [
  // Impuestos no deducibles
  "Deducciones de impuestos no aceptadas (GMF, vehículos, patrimonio)",
  "50% del ICA pagado (tomado como descuento)",
  "50% del GMF pagado",
  "Impuestos pagados al exterior no deducibles",
  // Multas y sanciones
  "Multas, sanciones e intereses moratorios DIAN",
  "Intereses moratorios fiscales",
  // Gastos sin causalidad/soporte
  "Gastos sin soporte de factura electrónica",
  "Gastos sin causalidad ni necesidad",
  "Gastos de períodos anteriores",
  "Costos en operaciones con vinculados sin precios de transferencia",
  // Pagos al exterior
  "Pagos al exterior sin retención en la fuente",
  "Pagos al exterior que exceden 15% renta líquida",
  "Pagos a paraísos fiscales no certificados",
  "Importación de tecnología, patentes y marcas no registrada",
  "Pagos de regalías a vinculados",
  // Donaciones y aportes
  "Donaciones que no cumplen requisitos legales",
  "Donaciones tomadas como descuento (Art. 257 E.T.)",
  // Subcapitalización (Art. 118-1 E.T.)
  "Intereses no deducibles por subcapitalización",
  "Otros gastos financieros no deducibles",
  // Salarios y parafiscales
  "Salarios sin pago de aportes parafiscales",
  // Pérdidas en enajenación
  "Pérdida en enajenación de acciones y venta de bienes raíces",
  "Pérdidas no deducibles por faltantes de inventario",
  // Método de participación (perdidas)
  "Pérdidas por método de participación",
  // Deterioro de inversiones
  "Deterioro de inversiones para cubrir una pérdida en sociedades",
  // Atenciones / regalos / publicidad
  "Monto que supera el límite permitido para atenciones",
  // Ajustes de precios de transferencia
  "Ajustes precios de transferencia · mayor ingreso",
  "Ajustes precios de transferencia · menor costo o deducción",
  // Operaciones gravadas con IVA
  "Gastos no deducibles por operaciones gravadas con IVA",
  // Arrendamiento financiero
  "Gastos no deducibles en contratos de arrendamiento financiero",
  // Atribución a ingresos exentos
  "Gastos atribuibles a ingresos exentos / no constitutivos",
  // Recuperación deducciones (Art. 195)
  "Recuperación de deducciones del ejercicio",
  // Dividendos declarados a favor
  "Dividendos declarados a favor del contribuyente en sociedades del exterior",
  // Otros
  "Limitación de costos por compras a proveedores ficticios",
  "Otros gastos no deducibles de naturaleza permanente",
] as const;

// Que RESTAN a la renta líquida (ingresos contables no fiscales,
// deducciones especiales). Cubre R141-R153 del Anexo 17 oficial.
export const CONCEPTOS_PERMANENTES_MENOS = [
  // INCRNGO
  "Ingresos no constitutivos de renta ni ganancia ocasional",
  // Utilidad en venta y método de participación
  "Utilidad en venta o enajenación de activos poseídos > 2 años (GO)",
  "Ganancias por método de participación",
  // Deducciones especiales
  "Deducciones especiales por inversiones (Art. 158-3 E.T., agro)",
  "Inversiones en investigación, desarrollo e innovación (I+D+i)",
  "Mayor valor del costo de activos fijos por reajuste fiscal",
  "Salarios con deducciones especiales (Ley 1429, Ley 2010)",
  "Reintegro o recuperación de provisiones que constituyeron deducción",
  // Atribución a establecimientos permanentes
  "Ajuste por atribución de rentas a establecimientos permanentes",
  // Otros beneficios
  "Otros beneficios fiscales de naturaleza permanente",
] as const;

// ============================================================
// DIFERENCIAS TEMPORALES (NIC 12 / Sección 29 NIIF)
// ============================================================

// DEDUCIBLES — generadas (suman al gasto fiscal o difieren ingreso)
// Cubre R195-R240 del Anexo 17 oficial.
export const CONCEPTOS_TEMPORALES_MAS = [
  // Deterioros (no deducibles fiscalmente, generan diferencia)
  "Deterioro de cartera (provisión contable > fiscal)",
  "Deterioro de inventarios",
  "Deterioro de propiedades, planta y equipo",
  "Deterioro de activos intangibles",
  "Deterioro de activos biológicos",
  "Deterioro de activos financieros (no cartera)",
  "Otras pérdidas por deterioro",
  // Depreciación exceso límite fiscal
  "Depreciación contable > fiscal · PPE",
  "Depreciación contable > fiscal · propiedades de inversión",
  "Depreciación contable > fiscal · activos biológicos",
  "Depreciación contable > fiscal · otros activos",
  // Amortización
  "Amortización contable > fiscal de intangibles",
  // Valor razonable (pérdidas)
  "Pérdidas por medición a valor razonable · propiedades de inversión",
  "Pérdidas por medición a valor razonable · instrumentos derivados",
  // Provisiones contables
  "Provisiones contables no aceptadas fiscalmente",
  "Beneficios a empleados no pagados al 31-dic",
  "Pasivos estimados no realizados",
  "Otras provisiones asociadas a pasivos de monto o fecha incierta",
  // Diferencia en cambio
  "Pérdida por diferencia en cambio no realizada",
  // Pagos basados en acciones
  "Por pagos basados en acciones",
  // Otros
  "Pérdidas esperadas en contratos de construcción y prestación de servicios",
  "Intereses implícitos (ventas o préstamos concedidos)",
  "Costos por préstamos atribuibles a activos aptos",
  "Pasivos por ingresos diferidos · programas de fidelización",
  "Gastos de establecimiento",
  "Gastos de investigación, desarrollo e innovación (capitalizables)",
  "Aportes seg. social pagados después del cierre",
  "Otras diferencias temporales deducibles",
] as const;

// IMPONIBLES — reversiones (ingresos contables que se difieren al fiscal)
// Cubre R243+ del Anexo 17 oficial.
export const CONCEPTOS_TEMPORALES_MENOS = [
  // Depreciaciones aceptadas fiscalmente (NIIF distinto)
  "Costos atribuidos en transición IFRS (depreciación adicional fiscal)",
  "Aplicación del modelo de revaluación · depreciación adicional",
  "Costos estimados de desmantelamiento",
  // Diferencia en cambio (ganancias)
  "Ganancia por diferencia en cambio no realizada",
  // Activos biológicos / valor razonable
  "Activos biológicos · medición a valor razonable (utilidad)",
  // Inventarios
  "Inventarios · método de costeo distinto al fiscal",
  // Otros
  "Diferencia depreciación fiscal > contable",
  "Diferencia amortización fiscal > contable",
  "Otras diferencias temporales imponibles",
] as const;

// Compatibilidad con form actual (que no separa por signo)
export const CONCEPTOS_PERMANENTES = [
  ...CONCEPTOS_PERMANENTES_MAS,
  ...CONCEPTOS_PERMANENTES_MENOS,
];
export const CONCEPTOS_TEMPORALES = [
  ...CONCEPTOS_TEMPORALES_MAS,
  ...CONCEPTOS_TEMPORALES_MENOS,
];
