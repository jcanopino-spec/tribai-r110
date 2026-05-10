// F2516 · Hoja 6 · Activos Fijos
//
// Movimiento del año de PP&E e intangibles por categoría:
//
//   SF Neto Contable = SI + Adiciones − Retiros − Deprec Acum − Deprec Año
//   SF Fiscal        = SF Neto Contable + Ajuste Fiscal
//
// El total contable debe cuadrar con R40 (intangibles) + R42 (PP&E) del F110.

export type F2516H6Categoria = {
  id: string;
  categoria: string;
  tipo: "ppe" | "intangible";
  ayuda: string;
};

export const F2516_H6_CATEGORIAS: F2516H6Categoria[] = [
  // Propiedad, planta y equipo · alimenta R42
  { id: "TERRENOS", categoria: "Terrenos", tipo: "ppe", ayuda: "No depreciables." },
  { id: "EDIFICACIONES", categoria: "Edificaciones", tipo: "ppe", ayuda: "Vida útil 30-50 años." },
  { id: "MAQUINARIA", categoria: "Maquinaria y equipo", tipo: "ppe", ayuda: "Vida útil típica 10 años." },
  { id: "EQUIPO_OFICINA", categoria: "Equipo de oficina", tipo: "ppe", ayuda: "Vida útil 5-10 años." },
  { id: "COMPUTO", categoria: "Equipo de cómputo y comunicaciones", tipo: "ppe", ayuda: "Vida útil 3-5 años." },
  { id: "VEHICULOS", categoria: "Vehículos", tipo: "ppe", ayuda: "Vida útil 5 años." },
  { id: "MUEBLES", categoria: "Muebles y enseres", tipo: "ppe", ayuda: "Vida útil 10 años." },
  { id: "CONSTRUCCIONES_CURSO", categoria: "Construcciones en curso", tipo: "ppe", ayuda: "No depreciables hasta puesta en servicio." },
  // Intangibles · alimenta R40
  { id: "SOFTWARE", categoria: "Software (intangible)", tipo: "intangible", ayuda: "Vida útil 3-5 años · Art. 143-1 E.T." },
  { id: "MARCAS_PATENTES", categoria: "Marcas y patentes", tipo: "intangible", ayuda: "Vida útil legal o económica." },
  { id: "PLUSVALIA", categoria: "Plusvalía / Goodwill", tipo: "intangible", ayuda: "No deducible fiscalmente." },
  { id: "OTROS_INTANGIBLES", categoria: "Otros intangibles", tipo: "intangible", ayuda: "Licencias, derechos de uso, etc." },
];

export type F2516H6Captura = {
  declaracion_id: string;
  categoria_id: string;
  categoria: string;
  saldo_inicial: number;
  adiciones: number;
  retiros: number;
  deprec_acumulada: number;
  deprec_ano: number;
  ajuste_fiscal: number;
  observacion: string | null;
};

export type F2516H6FilaCalculada = {
  categoria: F2516H6Categoria;
  saldoInicial: number;
  adiciones: number;
  retiros: number;
  deprecAcumulada: number;
  deprecAno: number;
  sfNetoContable: number;
  ajusteFiscal: number;
  sfFiscal: number;
  observacion: string | null;
};

export type F2516H6Resumen = {
  filas: F2516H6FilaCalculada[];
  totalContablePPE: number;
  totalContableIntangibles: number;
  totalContable: number;
  totalFiscalPPE: number;
  totalFiscalIntangibles: number;
  totalFiscal: number;
};

export function computarH6(capturas: F2516H6Captura[]): F2516H6Resumen {
  const byId = new Map<string, F2516H6Captura>();
  for (const c of capturas) byId.set(c.categoria_id, c);

  const filas: F2516H6FilaCalculada[] = F2516_H6_CATEGORIAS.map((cat) => {
    const c = byId.get(cat.id);
    const saldoInicial = c?.saldo_inicial ?? 0;
    const adiciones = c?.adiciones ?? 0;
    const retiros = c?.retiros ?? 0;
    const deprecAcumulada = c?.deprec_acumulada ?? 0;
    const deprecAno = c?.deprec_ano ?? 0;
    const ajusteFiscal = c?.ajuste_fiscal ?? 0;
    const sfNetoContable =
      saldoInicial + adiciones - retiros - deprecAcumulada - deprecAno;
    const sfFiscal = sfNetoContable + ajusteFiscal;
    return {
      categoria: cat,
      saldoInicial,
      adiciones,
      retiros,
      deprecAcumulada,
      deprecAno,
      sfNetoContable,
      ajusteFiscal,
      sfFiscal,
      observacion: c?.observacion ?? null,
    };
  });

  const ppe = filas.filter((f) => f.categoria.tipo === "ppe");
  const intangibles = filas.filter((f) => f.categoria.tipo === "intangible");

  const totalContablePPE = ppe.reduce((s, f) => s + f.sfNetoContable, 0);
  const totalContableIntangibles = intangibles.reduce(
    (s, f) => s + f.sfNetoContable,
    0,
  );
  const totalContable = totalContablePPE + totalContableIntangibles;

  const totalFiscalPPE = ppe.reduce((s, f) => s + f.sfFiscal, 0);
  const totalFiscalIntangibles = intangibles.reduce((s, f) => s + f.sfFiscal, 0);
  const totalFiscal = totalFiscalPPE + totalFiscalIntangibles;

  return {
    filas,
    totalContablePPE,
    totalContableIntangibles,
    totalContable,
    totalFiscalPPE,
    totalFiscalIntangibles,
    totalFiscal,
  };
}
