// Anexo 26 · Ingresos No Constitutivos de Renta ni Ganancia Ocasional

export type State = { error: string | null; ok: boolean };

// 32 conceptos del .xlsm (descripción acortada + normatividad típica)
export const PLANTILLAS = [
  { c: "Dividendos y participaciones", n: "Art. 48 y 49 ET" },
  { c: "Utilidad en enajenación de acciones", n: "Art. 36-1 ET" },
  { c: "Utilidades en procesos de democratización", n: "Art. 36-4 ET" },
  { c: "Indemnizaciones por seguros de daño", n: "Art. 45 ET" },
  { c: "Indemnizaciones por destrucción o renovación de cultivos", n: "Art. 46 ET" },
  { c: "Aportes de entidades estatales para sobrecostos en servicios", n: "Art. 47-1 ET" },
  { c: "Recursos percibidos por organizaciones no gubernamentales", n: "Art. 47-2 ET" },
  { c: "Liberación de la reserva por depreciación acelerada", n: "Art. 130 ET" },
  { c: "Incentivo a la Capitalización Rural (ICR)", n: "Art. 52 ET" },
  { c: "Retribución como recompensa", n: "Art. 42 ET" },
  { c: "Utilidad en enajenación de inmuebles a entidades públicas", n: "Art. 37 ET" },
  { c: "Distribución de utilidades de fondos de capital privado", n: "Art. 23-1 ET" },
  { c: "Donaciones a partidos, movimientos y campañas políticas", n: "Art. 47 ET" },
  { c: "Utilidad en procesos de capitalización", n: "Art. 36-3 ET" },
  { c: "Recibidos por contribuyente con régimen especial", n: "Casos especiales" },
  { c: "Recursos administrados por consorcios o uniones temporales", n: "" },
  { c: "Capitalización de utilidades líquidas", n: "Art. 36-3 ET" },
  { c: "Remuneración por labores de campañas electorales", n: "" },
  { c: "Apoyos económicos no reembolsables del Estado", n: "Art. 46 ET" },
  { c: "Recursos del Fondo de Garantías de Entidades Cooperativas", n: "" },
  { c: "Componente inflacionario de rendimientos financieros", n: "Art. 38, 39 ET" },
  { c: "Enajenación de inmuebles para reforma urbana", n: "Art. 37 ET" },
  { c: "Dividendos y beneficios distribuidos a CHC", n: "Art. 895 ET" },
  { c: "Rentas o ganancias ocasionales no gravadas tratados internacionales", n: "" },
  { c: "Certificados de Incentivo Forestal (CIF)", n: "Ley 139/1994" },
  { c: "Premios en concursos nacionales o internacionales", n: "" },
  { c: "Contraprestación por servicios públicos domiciliarios", n: "" },
  { c: "Donaciones Protocolo de Montreal", n: "" },
  { c: "Apoyos económicos no reembolsables programa de estudios", n: "" },
  { c: "Utilidades repartidas mediante acciones", n: "Art. 36-3 ET" },
  { c: "Por aplicación de algún beneficio especial", n: "" },
  { c: "Utilidades distribuidas por sociedades nacionales (CHC)", n: "Art. 895 ET" },
];
