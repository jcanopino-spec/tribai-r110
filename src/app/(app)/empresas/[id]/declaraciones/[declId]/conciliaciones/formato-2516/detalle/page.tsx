// Vista DETALLE FISCAL del Formato 2516 · replica la hoja "Detalle Fiscal"
// del .xlsm guía v5 con su estructura completa: cada renglón del F110 con
// las cuentas PUC que lo componen, valor contable (del balance) y valor
// fiscal (saldo + ajustes). Es el formato que cumple con la obligación
// de presentación detallada del F2516 (Resolución DIAN 71/2019).

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loadF2516DetalleCompleto,
  agruparPorRenglon,
} from "@/lib/f2516-detalle";
import { ModuloHeader } from "@/components/modulo-header";

export const metadata = { title: "F2516 Detalle Fiscal" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

const DIAN_BLUE = "#1B5AAB";
const DIAN_BLUE_LIGHT = "#EAF2F9";

// Secciones del F2516 según el .xlsm (cada rango de renglones es una
// sección con un título visual estilo barra azul vertical)
type SeccionDef = {
  titulo: string;
  desde: number;
  hasta: number;
};
const SECCIONES: readonly SeccionDef[] = [
  { titulo: "DATOS INFORMATIVOS · NÓMINA", desde: 33, hasta: 35 },
  { titulo: "PATRIMONIO · ACTIVOS", desde: 36, hasta: 43 },
  { titulo: "PATRIMONIO · PASIVOS", desde: 45, hasta: 45 },
  { titulo: "INGRESOS", desde: 47, hasta: 61 },
  { titulo: "COSTOS Y DEDUCCIONES", desde: 62, hasta: 69 },
  { titulo: "RENTA", desde: 70, hasta: 79 },
  { titulo: "GANANCIAS OCASIONALES", desde: 80, hasta: 83 },
  { titulo: "LIQUIDACIÓN PRIVADA", desde: 84, hasta: 114 },
];

export default async function F2516DetallePage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, empresa_id, estado")
    .eq("id", declId)
    .single();
  if (!declaracion) notFound();

  const { data: empresa } = await supabase
    .from("empresas")
    .select("razon_social, nit, dv")
    .eq("id", declaracion.empresa_id)
    .single();
  if (!empresa) notFound();

  const filas = await loadF2516DetalleCompleto(supabase, declId);
  const porRenglon = agruparPorRenglon(filas);

  // Agrupar renglones por sección
  const seccionesAgrupadas = SECCIONES.map((s) => {
    const renglones: Array<{
      total: ReturnType<typeof agruparPorRenglon> extends Map<number, infer T>
        ? T
        : never;
      rgl: number;
    }> = [];
    for (let r = s.desde; r <= s.hasta; r++) {
      const data = porRenglon.get(r);
      if (data) renglones.push({ total: data, rgl: r });
    }
    return { ...s, renglones };
  });

  // Stats
  const totalCuentasConSaldo = filas.filter(
    (f) => f.item.tipo === "cuenta" && (f.contable !== 0 || f.fiscal !== 0),
  ).length;
  const totalRenglonesActivos = filas.filter(
    (f) => f.item.tipo === "renglon_total" && f.contable !== 0,
  ).length;

  const nitEmpresa = empresa.nit
    ? `${empresa.nit}${empresa.dv ? `-${empresa.dv}` : ""}`
    : "—";

  return (
    <div className="max-w-7xl">
      <ModuloHeader
        titulo="Formato 2516 Detallado"
        moduloLabel="Conciliación fiscal · Resolución DIAN 71/2019"
        volverHref={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones/formato-2516`}
        volverLabel="F2516 compacto"
        contexto={`${empresa.razon_social} · NIT ${nitEmpresa} · AG ${declaracion.ano_gravable}`}
      />

      <p className="mb-6 max-w-4xl text-sm text-muted-foreground">
        Vista detallada con la estructura completa del Detalle Fiscal del
        archivo guía v5: cada renglón del F110 con las cuentas PUC que lo
        componen, valor contable agregado del balance y valor fiscal con
        ajustes. Esta es la forma que cumple con la obligación de
        presentación detallada del F2516 ante la DIAN.
      </p>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Stat
          label="Renglones con saldo"
          value={`${totalRenglonesActivos}/${SECCIONES.reduce((s, x) => s + (x.hasta - x.desde + 1), 0)}`}
        />
        <Stat label="Cuentas con saldo" value={String(totalCuentasConSaldo)} />
        <Stat label="Estado declaración" value={declaracion.estado} />
      </div>

      {seccionesAgrupadas.map((sec) => {
        if (sec.renglones.length === 0) return null;
        return (
          <section key={sec.titulo} className="mb-10 border border-black">
            <header
              className="border-b border-black px-4 py-2 text-white"
              style={{ backgroundColor: DIAN_BLUE }}
            >
              <h2 className="font-mono text-xs uppercase tracking-[0.1em]">
                {sec.titulo}
              </h2>
            </header>

            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: DIAN_BLUE_LIGHT }}>
                  <Th>RGL</Th>
                  <Th>PUC</Th>
                  <Th className="text-left">CONCEPTO</Th>
                  <Th align="right">CONTABLE</Th>
                  <Th align="right">FISCAL</Th>
                  <Th align="right">DIF.</Th>
                </tr>
              </thead>
              <tbody>
                {sec.renglones.map(({ total: data, rgl }) => (
                  <RenglonGrupo
                    key={rgl}
                    rgl={rgl}
                    total={data.total}
                    cuentas={data.cuentas}
                  />
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {/* Footer con info legal */}
      <footer className="mt-12 border border-dashed border-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Cómo se calculan los valores</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>CONTABLE</strong>: agregación del saldo del balance por
            prefijo PUC (replica el SUMIF del .xlsm). Solo cuentas hoja —
            las resumen se excluyen para evitar duplicación.
          </li>
          <li>
            <strong>FISCAL</strong>: saldo contable + ajuste débito − ajuste
            crédito. Si la cuenta no tiene ajustes, fiscal = contable.
          </li>
          <li>
            <strong>DIF</strong>: fiscal − contable. Diferencias positivas
            indican ajustes que aumentan el valor fiscal (mayor renta o
            patrimonio fiscal).
          </li>
          <li>
            <strong>RGL total</strong>: suma agregada de las cuentas hijas
            por renglón del F110. Cuadra contra el formulario.
          </li>
        </ul>
        <p className="mt-3 text-[10px] uppercase tracking-[0.08em]">
          Documento de trabajo · No oficial · Validar valores en MUISCA antes
          de presentar · Resolución DIAN 071/2019
        </p>
      </footer>
    </div>
  );
}

type FilaCalc = ReturnType<typeof agruparPorRenglon> extends Map<
  number,
  infer T
>
  ? T
  : never;

function RenglonGrupo({
  rgl,
  total,
  cuentas,
}: {
  rgl: number;
  total: FilaCalc["total"];
  cuentas: FilaCalc["cuentas"];
}) {
  const tieneSaldo = total.contable !== 0 || total.fiscal !== 0;
  return (
    <>
      <tr
        className="border-y-2 border-foreground/40 font-bold"
        style={{ backgroundColor: tieneSaldo ? "#F5F8FB" : "transparent" }}
      >
        <Td>
          <span className="font-mono text-xs">{rgl}</span>
        </Td>
        <Td>—</Td>
        <Td>{total.item.concepto}</Td>
        <NumTd v={total.contable} bold />
        <NumTd v={total.fiscal} bold />
        <NumTd v={total.diferencia} bold dim={total.diferencia === 0} />
      </tr>
      {cuentas.map((c, i) => (
        <tr
          key={`${rgl}-${i}`}
          className="border-b border-border/50 text-xs"
        >
          <Td />
          <Td>
            <span className="font-mono text-[10px]">{c.item.puc}</span>
          </Td>
          <Td className="text-muted-foreground">{c.item.concepto}</Td>
          <NumTd v={c.contable} small />
          <NumTd v={c.fiscal} small />
          <NumTd v={c.diferencia} small dim={c.diferencia === 0} />
        </tr>
      ))}
    </>
  );
}

function Th({
  children,
  align,
  className = "",
}: {
  children: React.ReactNode;
  align?: "right";
  className?: string;
}) {
  return (
    <th
      className={`border-b-2 border-black px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] ${
        align === "right" ? "text-right" : ""
      } ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-2 py-1 text-sm align-top ${className}`}>{children}</td>
  );
}

function NumTd({
  v,
  bold,
  small,
  dim,
}: {
  v: number;
  bold?: boolean;
  small?: boolean;
  dim?: boolean;
}) {
  return (
    <td
      className={`px-2 py-1 text-right font-mono tabular-nums align-top ${
        bold ? "font-bold" : ""
      } ${small ? "text-[10px]" : "text-xs"} ${
        dim ? "text-muted-foreground/40" : v < 0 ? "text-destructive" : ""
      }`}
    >
      {v === 0 ? "" : FMT.format(v)}
    </td>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-lg tabular-nums">{value}</p>
    </div>
  );
}
