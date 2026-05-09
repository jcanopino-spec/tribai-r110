"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveValoresAction, type SaveValoresState } from "./actions";
import {
  RENGLONES_COMPUTADOS,
  FORMULAS_LEYENDA,
  NOTAS_RENGLON,
  computarRenglones,
} from "@/engine/form110";
import { normalizarSigno } from "@/engine/utils";
import { validarFormulario } from "@/engine/validaciones";
import Link from "next/link";
import {
  IconDashboard,
  IconForm110,
  IconTable,
  IconGear,
  IconFolders,
  IconConciliacion,
  IconValidate,
  IconChecklist,
  IconCalculator,
} from "@/components/icons";

type Renglon = { numero: number; descripcion: string; seccion: string };
type Valor = { numero: number; valor: number };

const initial: SaveValoresState = { error: null, saved: 0, savedAt: null };

const FORMATTER = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function formatValor(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "";
  return FORMATTER.format(v);
}

function parseValor(s: string): number {
  const cleaned = s.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

type AniosDeclarando = "primero" | "segundo" | "tercero_o_mas";

export function DeclaracionEditor({
  declId,
  empresaId,
  renglones,
  valoresIniciales,
  tarifaRegimen,
  impuestoNetoAnterior,
  aniosDeclarando,
  presentacion,
  calculaSancionExtemporaneidad,
  calculaSancionCorreccion,
  mayorValorCorreccion,
  existeEmplazamiento,
  reduccionSancion,
  uvtVigente,
  patrimonioLiquidoAnterior,
  esInstitucionFinanciera,
  aplicaTasaMinima,
  utilidadContableNeta,
  difPermanentesAumentan,
  totalNomina,
  aportesSegSocial,
  aportesParaFiscales,
  beneficioAuditoria12m,
  beneficioAuditoria6m,
  totalAutorretenciones,
  totalRetenciones,
  totalDescuentosTributarios,
  goIngresos,
  goCostos,
  goNoGravada,
  totalRentasExentas,
  totalCompensaciones,
  totalRecuperaciones,
  rentaPresuntiva,
  dividendos,
  totalIncrngo,
}: {
  declId: string;
  empresaId: string;
  renglones: Renglon[];
  valoresIniciales: Valor[];
  tarifaRegimen: number | null;
  impuestoNetoAnterior: number;
  aniosDeclarando: AniosDeclarando;
  presentacion: { estado: "no_presentada" | "oportuna" | "extemporanea"; mesesExtemporanea?: number };
  calculaSancionExtemporaneidad: boolean;
  calculaSancionCorreccion: boolean;
  mayorValorCorreccion: number;
  existeEmplazamiento: boolean;
  reduccionSancion: "0" | "50" | "75";
  uvtVigente: number | null;
  patrimonioLiquidoAnterior: number;
  esInstitucionFinanciera: boolean;
  aplicaTasaMinima: boolean;
  utilidadContableNeta: number;
  difPermanentesAumentan: number;
  totalNomina: number;
  aportesSegSocial: number;
  aportesParaFiscales: number;
  beneficioAuditoria12m: boolean;
  beneficioAuditoria6m: boolean;
  totalAutorretenciones: number;
  totalRetenciones: number;
  totalDescuentosTributarios: number;
  goIngresos: number;
  goCostos: number;
  goNoGravada: number;
  totalRentasExentas: number;
  totalCompensaciones: number;
  totalRecuperaciones: number;
  rentaPresuntiva: number;
  dividendos: {
    r49: number; r50: number; r51: number; r52: number;
    r53: number; r54: number; r55: number; r56: number;
  };
  totalIncrngo: number;
}) {
  const action = saveValoresAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);

  // Mapa de inputs (excluye computados) — los computados se derivan en cada render.
  // Aplicamos normalizarSigno por seguridad: aunque DB ya esté normalizada,
  // garantizamos que ningún renglón positivo se muestre con signo negativo.
  const initialMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const v of valoresIniciales) {
      if (RENGLONES_COMPUTADOS.has(v.numero)) continue;
      m.set(v.numero, formatValor(normalizarSigno(v.numero, Number(v.valor))));
    }
    return m;
  }, [valoresIniciales]);

  const [valores, setValores] = useState<Map<number, string>>(initialMap);

  const renglonesPorSeccion = useMemo(() => {
    const m = new Map<string, Renglon[]>();
    for (const r of renglones) {
      const arr = m.get(r.seccion) ?? [];
      arr.push(r);
      m.set(r.seccion, arr);
    }
    return m;
  }, [renglones]);

  // Numérico actual: combina inputs (en string) con derivados (calculados).
  const numerico = useMemo(() => {
    const base = new Map<number, number>();
    for (const [num, str] of valores) base.set(num, parseValor(str));
    return computarRenglones(base, {
      tarifaRegimen: tarifaRegimen ?? undefined,
      impuestoNetoAnterior,
      aniosDeclarando,
      presentacion,
      calculaSancionExtemporaneidad,
      calculaSancionCorreccion,
      mayorValorCorreccion,
      existeEmplazamiento,
      reduccionSancion,
      uvtVigente: uvtVigente ?? undefined,
      patrimonioLiquidoAnterior,
      esInstitucionFinanciera,
      aplicaTasaMinima,
      utilidadContableNeta,
      difPermanentesAumentan,
      totalNomina,
      aportesSegSocial,
      aportesParaFiscales,
      totalAutorretenciones,
      totalRetenciones,
      totalDescuentosTributarios,
      goIngresos,
      goCostos,
      goNoGravada,
      totalRentasExentas,
      totalCompensaciones,
      totalRecuperaciones,
      rentaPresuntiva,
      dividendos,
      totalIncrngo,
    });
  }, [
    valores,
    tarifaRegimen,
    impuestoNetoAnterior,
    aniosDeclarando,
    presentacion,
    calculaSancionExtemporaneidad,
    calculaSancionCorreccion,
    mayorValorCorreccion,
    existeEmplazamiento,
    reduccionSancion,
    uvtVigente,
    patrimonioLiquidoAnterior,
    esInstitucionFinanciera,
    aplicaTasaMinima,
    utilidadContableNeta,
    difPermanentesAumentan,
    totalNomina,
    aportesSegSocial,
    aportesParaFiscales,
    totalAutorretenciones,
    totalRetenciones,
    totalDescuentosTributarios,
    goIngresos,
    goCostos,
    goNoGravada,
    totalRentasExentas,
    totalCompensaciones,
    totalRecuperaciones,
    rentaPresuntiva,
    dividendos,
    totalIncrngo,
  ]);

  const totales = useMemo(() => {
    return {
      patrimonioBruto: numerico.get(44) ?? 0,
      patrimonioLiquido: numerico.get(46) ?? 0,
      ingresosBrutos: numerico.get(58) ?? 0,
      ingresosNetos: numerico.get(61) ?? 0,
      totalCostos: numerico.get(67) ?? 0,
    };
  }, [numerico]);

  const validaciones = useMemo(
    () =>
      validarFormulario(numerico, {
        tarifaRegimen,
        impuestoNetoAnterior,
        aniosDeclarando,
        presentacion,
        calculaSancionExtemporaneidad,
        beneficioAuditoria12m,
        beneficioAuditoria6m,
      }),
    [
      numerico,
      tarifaRegimen,
      impuestoNetoAnterior,
      aniosDeclarando,
      presentacion,
      calculaSancionExtemporaneidad,
      beneficioAuditoria12m,
      beneficioAuditoria6m,
    ],
  );
  const errores = validaciones.filter((v) => v.nivel === "error").length;
  const warns = validaciones.filter((v) => v.nivel === "warn").length;

  return (
    <form action={formAction}>
      {validaciones.length > 0 ? (
        <section className="mb-8 space-y-2">
          {validaciones.map((vw, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${
                vw.nivel === "error"
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : vw.nivel === "warn"
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border bg-muted/30"
              }`}
            >
              <span
                className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  vw.nivel === "error"
                    ? "bg-destructive"
                    : vw.nivel === "warn"
                      ? "bg-amber-500"
                      : "bg-muted-foreground"
                }`}
              />
              <p>
                {vw.renglon ? (
                  <span className="font-mono mr-1">R{vw.renglon}</span>
                ) : null}
                {vw.mensaje}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {/* Nav agrupado · 4 categorías */}
      <div className="mb-6 space-y-2">
        {/* Acción primaria · Dashboard + Form110 */}
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/dashboard`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-foreground/40 bg-foreground/[0.04] px-4 text-xs font-medium hover:bg-foreground/[0.08]"
          >
            <IconDashboard size={14} /> Dashboard
          </Link>
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/formulario-110`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-xs text-background hover:opacity-90"
          >
            <IconForm110 size={14} /> Formulario 110 →
          </Link>
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/imprimir`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
          >
            <IconTable size={14} /> Vista plana →
          </Link>
        </div>

        {/* Trabajo · captura y conciliación */}
        <div className="flex flex-wrap justify-end gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground self-center mr-1">
            Trabajo
          </span>
          <NavLink
            href={`/empresas/${empresaId}/declaraciones/${declId}/configuracion`}
            icon={<IconGear size={14} />}
          >
            Configuración
          </NavLink>
          <NavLink
            href={`/empresas/${empresaId}/declaraciones/${declId}/anexos`}
            icon={<IconFolders size={14} />}
          >
            Anexos
          </NavLink>
          <NavLink
            href={`/empresas/${empresaId}/declaraciones/${declId}/conciliaciones`}
            icon={<IconConciliacion size={14} />}
          >
            Conciliaciones
          </NavLink>
        </div>

        {/* Análisis · revisión y planeación */}
        <div className="flex flex-wrap justify-end gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground self-center mr-1">
            Análisis
          </span>
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/validaciones`}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-4 text-xs ${
              errores > 0
                ? "border-destructive/60 bg-destructive/5 text-destructive hover:bg-destructive/10"
                : warns > 0
                  ? "border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10"
                  : "border-border-secondary hover:bg-muted"
            }`}
          >
            <IconValidate size={14} /> Validaciones
            {errores > 0 ? <span className="ml-1 font-mono">· {errores} err</span> : null}
            {warns > 0 ? <span className="ml-1 font-mono">· {warns} warn</span> : null}
            {errores === 0 && warns === 0 ? <span className="ml-1 font-mono">· OK</span> : null}
          </Link>
          <NavLink
            href={`/empresas/${empresaId}/declaraciones/${declId}/checklist`}
            icon={<IconChecklist size={14} />}
          >
            Checklist
          </NavLink>
          <NavLink
            href={`/empresas/${empresaId}/declaraciones/${declId}/simulador`}
            icon={<IconCalculator size={14} />}
          >
            Simulador
          </NavLink>
        </div>
      </div>

      <section className="mb-10 flex flex-wrap items-center gap-4 border border-border p-4">
        <div className="flex-1 min-w-[200px]">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Configuración aplicada
          </p>
          <p className="mt-1 text-sm">
            Impuesto AG anterior:{" "}
            <span className="font-mono">{formatValor(impuestoNetoAnterior) || "0"}</span>
            {" · "}Años declarando:{" "}
            <span className="font-mono">
              {aniosDeclarando === "primero"
                ? "primero"
                : aniosDeclarando === "segundo"
                  ? "segundo"
                  : "tercero o más"}
            </span>
          </p>
        </div>
        <Link
          href={`/empresas/${empresaId}/declaraciones/${declId}/configuracion`}
          className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-xs text-primary-foreground hover:opacity-90"
        >
          Editar configuración →
        </Link>
      </section>

      <div className="space-y-12">
        {Array.from(renglonesPorSeccion.entries()).map(([seccion, items]) => {
          // En "Datos informativos" (R32-R35) ocultamos filas en cero.
          // Estos renglones vienen del anexo de seguridad social (R33-R35)
          // y de configuración (R32 pérdidas acumuladas). Si están en 0,
          // no aportan al usuario · solo agregan ruido visual.
          const ocultarCeros = seccion === "Datos informativos";
          const itemsVisibles = ocultarCeros
            ? items.filter((r) => {
                const isComputado = RENGLONES_COMPUTADOS.has(r.numero);
                const v = isComputado
                  ? Number(numerico.get(r.numero) ?? 0)
                  : Number(String(valores.get(r.numero) ?? "").replace(/[^0-9-]/g, ""));
                return v !== 0;
              })
            : items;
          const totalOcultos = items.length - itemsVisibles.length;
          if (ocultarCeros && itemsVisibles.length === 0) {
            return (
              <section key={seccion}>
                <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">{seccion}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Sin valores capturados · {items.length} renglones disponibles
                  desde la configuración y los anexos.
                </p>
              </section>
            );
          }
          return (
          <section key={seccion}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">{seccion}</h2>
              {ocultarCeros && totalOcultos > 0 ? (
                <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                  {totalOcultos} en cero ocultos
                </p>
              ) : null}
            </div>
            <div className="mt-4 overflow-hidden border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                      N°
                    </th>
                    <th className="px-4 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                      Descripción
                    </th>
                    <th className="px-4 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                      Valor (COP)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itemsVisibles.map((r) => {
                    const isComputado = RENGLONES_COMPUTADOS.has(r.numero);
                    const valor = isComputado
                      ? numerico.get(r.numero) ?? 0
                      : valores.get(r.numero) ?? "";
                    const nota = NOTAS_RENGLON[r.numero];
                    return (
                      <tr
                        key={r.numero}
                        className={`border-t border-border ${isComputado ? "bg-muted/30" : ""}`}
                      >
                        <td className="px-4 py-1.5 align-top font-mono">{r.numero}</td>
                        <td className="px-4 py-1.5 align-top">
                          {r.descripcion}
                          {isComputado ? (
                            <span className="ml-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                              · {FORMULAS_LEYENDA[r.numero] ?? "calculado"}
                            </span>
                          ) : null}
                          {nota ? (
                            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{nota}</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-1 text-right align-top">
                          {isComputado ? (
                            <p className="px-2 py-1.5 font-mono font-medium">
                              {formatValor(Number(valor))}
                            </p>
                          ) : (
                            <input
                              name={`v_${r.numero}`}
                              inputMode="numeric"
                              value={valor as string}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const cleaned = raw.replace(/[^0-9]/g, "");
                                const n = cleaned === "" ? "" : formatValor(Number(cleaned));
                                const next = new Map(valores);
                                next.set(r.numero, n);
                                setValores(next);
                              }}
                              className="h-8 w-full rounded border border-transparent bg-transparent px-2 text-right font-mono hover:border-border focus:border-ring focus:bg-card focus:outline-none"
                              placeholder="0"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          );
        })}
      </div>

      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border bg-background py-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <ResumenItem label="Patrimonio bruto" value={totales.patrimonioBruto} />
          <ResumenItem label="Patrimonio líquido" value={totales.patrimonioLiquido} />
          <ResumenItem label="Ingresos brutos" value={totales.ingresosBrutos} />
          <ResumenItem label="Ingresos netos" value={totales.ingresosNetos} />
          <ResumenItem label="Total costos" value={totales.totalCostos} />
        </div>

        <div className="flex items-center gap-3">
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {!state.error && state.saved > 0 ? (
            <p className="text-sm text-muted-foreground">
              Guardados {state.saved} valores ·{" "}
              {state.savedAt ? new Date(state.savedAt).toLocaleTimeString("es-CO") : ""}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar borrador"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function ResumenItem({ label, value }: { label: string; value: number }) {
  return (
    <p>
      <span className="font-mono uppercase tracking-[0.05em] text-muted-foreground">{label}:</span>{" "}
      <span className="font-mono">{FORMATTER.format(value)}</span>
    </p>
  );
}

function NavLink({
  href,
  children,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
    >
      {icon}
      {children}
    </Link>
  );
}
