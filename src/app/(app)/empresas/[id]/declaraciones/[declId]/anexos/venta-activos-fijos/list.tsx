"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { deleteVentaAfAction, updateVentaAfAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const c = s.replace(/[^0-9]/g, "");
  return c ? FMT.format(Number(c)) : "";
}
function parseNum(s: string): number {
  const c = String(s ?? "").replace(/[^0-9]/g, "");
  const n = Number(c);
  return Number.isFinite(n) ? n : 0;
}

export type VentaAfItem = {
  id: number;
  posesion_mas_2_anos: boolean;
  fecha_compra: string | null;
  fecha_venta: string | null;
  detalle_activo: string;
  nit_comprador: string | null;
  precio_venta: number;
  costo_fiscal: number;
  depreciacion_acumulada: number;
  reajustes_fiscales: number;
  observacion: string | null;
};

/**
 * Calcula utilidad y pérdida según fórmula del .xlsm:
 *   utilidad = max(0, precio - (costo - depreciacion + reajustes))
 *   perdida  = max(0, (costo - depreciacion) - precio)
 */
export function calcularResultado(item: {
  precio_venta: number;
  costo_fiscal: number;
  depreciacion_acumulada: number;
  reajustes_fiscales: number;
}) {
  const costoNeto =
    item.costo_fiscal - item.depreciacion_acumulada + item.reajustes_fiscales;
  const utilidad = Math.max(0, item.precio_venta - costoNeto);
  const costoNetoSinReajustes =
    item.costo_fiscal - item.depreciacion_acumulada;
  const perdida = Math.max(0, costoNetoSinReajustes - item.precio_venta);
  return { utilidad, perdida, costoNeto };
}

export function VentaAfList({
  items,
  declId,
  empresaId,
}: {
  items: VentaAfItem[];
  declId: string;
  empresaId: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin ventas de activos fijos registradas.
      </p>
    );
  }

  const mas2 = items.filter((i) => i.posesion_mas_2_anos);
  const menos2 = items.filter((i) => !i.posesion_mas_2_anos);

  return (
    <div className="space-y-10">
      {mas2.length > 0 ? (
        <Section
          title="Posesión > 2 años · Ganancia Ocasional (R80/R81)"
          items={mas2}
          declId={declId}
          empresaId={empresaId}
        />
      ) : null}
      {menos2.length > 0 ? (
        <Section
          title="Posesión ≤ 2 años · Renta líquida ordinaria"
          items={menos2}
          declId={declId}
          empresaId={empresaId}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  items,
  declId,
  empresaId,
}: {
  title: string;
  items: VentaAfItem[];
  declId: string;
  empresaId: string;
}) {
  const subPrecio = items.reduce((s, x) => s + Number(x.precio_venta), 0);
  const subUtil = items.reduce(
    (s, x) =>
      s +
      calcularResultado({
        precio_venta: Number(x.precio_venta),
        costo_fiscal: Number(x.costo_fiscal),
        depreciacion_acumulada: Number(x.depreciacion_acumulada),
        reajustes_fiscales: Number(x.reajustes_fiscales),
      }).utilidad,
    0,
  );
  const subPerd = items.reduce(
    (s, x) =>
      s +
      calcularResultado({
        precio_venta: Number(x.precio_venta),
        costo_fiscal: Number(x.costo_fiscal),
        depreciacion_acumulada: Number(x.depreciacion_acumulada),
        reajustes_fiscales: Number(x.reajustes_fiscales),
      }).perdida,
    0,
  );

  return (
    <section>
      <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
        {title}
      </h2>
      <div className="mt-4 overflow-x-auto border border-border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Activo
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Precio venta
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Costo fiscal
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Depreciación
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Utilidad
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Pérdida
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <Row
                key={it.id}
                item={it}
                declId={declId}
                empresaId={empresaId}
              />
            ))}
            <tr className="border-t-2 border-border bg-muted/40 font-medium">
              <td className="px-3 py-2 text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Subtotal
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {FMT.format(subPrecio)}
              </td>
              <td colSpan={2}></td>
              <td className="px-3 py-2 text-right font-mono text-success">
                {FMT.format(subUtil)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-destructive">
                {FMT.format(subPerd)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({
  item,
  declId,
  empresaId,
}: {
  item: VentaAfItem;
  declId: string;
  empresaId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [posesion, setPosesion] = useState(item.posesion_mas_2_anos);
  const [detalle, setDetalle] = useState(item.detalle_activo);
  const [nit, setNit] = useState(item.nit_comprador ?? "");
  const [fechaC, setFechaC] = useState(item.fecha_compra ?? "");
  const [fechaV, setFechaV] = useState(item.fecha_venta ?? "");
  const [precio, setPrecio] = useState(
    item.precio_venta ? FMT.format(item.precio_venta) : "",
  );
  const [costo, setCosto] = useState(
    item.costo_fiscal ? FMT.format(item.costo_fiscal) : "",
  );
  const [depre, setDepre] = useState(
    item.depreciacion_acumulada ? FMT.format(item.depreciacion_acumulada) : "",
  );
  const [reajustes, setReajustes] = useState(
    item.reajustes_fiscales ? FMT.format(item.reajustes_fiscales) : "",
  );

  const { utilidad, perdida } = calcularResultado({
    precio_venta: Number(item.precio_venta),
    costo_fiscal: Number(item.costo_fiscal),
    depreciacion_acumulada: Number(item.depreciacion_acumulada),
    reajustes_fiscales: Number(item.reajustes_fiscales),
  });

  if (editing) {
    return (
      <tr className="border-t border-border bg-muted/30">
        <td className="px-3 py-2">
          <Input
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            className="text-xs"
          />
          <Input
            value={nit}
            onChange={(e) => setNit(e.target.value)}
            placeholder="NIT comprador"
            className="mt-1 font-mono text-xs"
          />
          <div className="mt-1 grid grid-cols-2 gap-1">
            <Input type="date" value={fechaC} onChange={(e) => setFechaC(e.target.value)} className="text-xs" />
            <Input type="date" value={fechaV} onChange={(e) => setFechaV(e.target.value)} className="text-xs" />
          </div>
          <label className="mt-1 flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={posesion}
              onChange={(e) => setPosesion(e.target.checked)}
              className="h-3 w-3 accent-foreground"
            />
            {">"}{" "}2 años (GO)
          </label>
        </td>
        <td className="px-3 py-2">
          <Input
            value={precio}
            onChange={(e) => setPrecio(fmtInput(e.target.value))}
            inputMode="numeric"
            className="text-right font-mono text-xs"
          />
        </td>
        <td className="px-3 py-2">
          <Input
            value={costo}
            onChange={(e) => setCosto(fmtInput(e.target.value))}
            inputMode="numeric"
            className="text-right font-mono text-xs"
          />
        </td>
        <td className="px-3 py-2">
          <Input
            value={depre}
            onChange={(e) => setDepre(fmtInput(e.target.value))}
            inputMode="numeric"
            className="text-right font-mono text-xs"
          />
          <Input
            value={reajustes}
            onChange={(e) => setReajustes(fmtInput(e.target.value))}
            inputMode="numeric"
            placeholder="Reajustes"
            className="mt-1 text-right font-mono text-xs"
          />
        </td>
        <td className="px-3 py-2 text-right text-xs text-muted-foreground">—</td>
        <td className="px-3 py-2 text-right text-xs text-muted-foreground">—</td>
        <td className="px-3 py-2 text-right">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await updateVentaAfAction(item.id, declId, empresaId, {
                    posesion_mas_2_anos: posesion,
                    fecha_compra: fechaC || null,
                    fecha_venta: fechaV || null,
                    detalle_activo: detalle,
                    nit_comprador: nit || null,
                    precio_venta: parseNum(precio),
                    costo_fiscal: parseNum(costo),
                    depreciacion_acumulada: parseNum(depre),
                    reajustes_fiscales: parseNum(reajustes),
                    observacion: item.observacion,
                  });
                  setEditing(false);
                  router.refresh();
                })
              }
              className="rounded-full bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPosesion(item.posesion_mas_2_anos);
                setDetalle(item.detalle_activo);
                setNit(item.nit_comprador ?? "");
                setFechaC(item.fecha_compra ?? "");
                setFechaV(item.fecha_venta ?? "");
                setPrecio(item.precio_venta ? FMT.format(item.precio_venta) : "");
                setCosto(item.costo_fiscal ? FMT.format(item.costo_fiscal) : "");
                setDepre(
                  item.depreciacion_acumulada
                    ? FMT.format(item.depreciacion_acumulada)
                    : "",
                );
                setReajustes(
                  item.reajustes_fiscales
                    ? FMT.format(item.reajustes_fiscales)
                    : "",
                );
                setEditing(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <p className="font-medium">{item.detalle_activo}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {item.nit_comprador ?? ""}
          {item.fecha_venta ? ` · ${item.fecha_venta}` : ""}
        </p>
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(Number(item.precio_venta))}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(Number(item.costo_fiscal))}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {FMT.format(Number(item.depreciacion_acumulada))}
      </td>
      <td className="px-3 py-2 text-right font-mono text-success">
        {utilidad > 0 ? FMT.format(utilidad) : "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-destructive">
        {perdida > 0 ? FMT.format(perdida) : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-base text-muted-foreground hover:text-foreground"
            title="Modificar"
          >
            ✏️
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              start(async () => {
                await deleteVentaAfAction(item.id, declId, empresaId);
                router.refresh();
              });
            }}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            {pending ? "…" : "Eliminar"}
          </button>
        </div>
      </td>
    </tr>
  );
}
