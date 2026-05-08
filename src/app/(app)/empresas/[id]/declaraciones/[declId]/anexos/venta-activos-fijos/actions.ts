"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addVentaAfAction(
  declId: string,
  empresaId: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada.", ok: false };

  const detalle_activo = String(form.get("detalle_activo") ?? "").trim();
  const nit_comprador = String(form.get("nit_comprador") ?? "").trim() || null;
  const fecha_compra = String(form.get("fecha_compra") ?? "").trim() || null;
  const fecha_venta = String(form.get("fecha_venta") ?? "").trim() || null;
  const posesion_mas_2_anos = form.get("posesion_mas_2_anos") === "on";
  const precio_venta = parseNum(String(form.get("precio_venta") ?? ""));
  const costo_fiscal = parseNum(String(form.get("costo_fiscal") ?? ""));
  const depreciacion_acumulada = parseNum(
    String(form.get("depreciacion_acumulada") ?? ""),
  );
  const reajustes_fiscales = parseNum(
    String(form.get("reajustes_fiscales") ?? ""),
  );
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!detalle_activo)
    return { error: "El detalle del activo es obligatorio.", ok: false };
  if (precio_venta <= 0)
    return { error: "El precio de venta debe ser mayor a cero.", ok: false };

  const { error } = await supabase.from("anexo_venta_activos_fijos").insert({
    declaracion_id: declId,
    posesion_mas_2_anos,
    fecha_compra,
    fecha_venta,
    detalle_activo,
    nit_comprador,
    precio_venta,
    costo_fiscal,
    depreciacion_acumulada,
    reajustes_fiscales,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteVentaAfAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  await supabase.from("anexo_venta_activos_fijos").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}

export async function updateVentaAfAction(
  id: number,
  declId: string,
  empresaId: string,
  data: {
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
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anexo_venta_activos_fijos")
    .update({
      posesion_mas_2_anos: data.posesion_mas_2_anos,
      fecha_compra: data.fecha_compra,
      fecha_venta: data.fecha_venta,
      detalle_activo: data.detalle_activo.trim(),
      nit_comprador: data.nit_comprador?.trim() || null,
      precio_venta: data.precio_venta,
      costo_fiscal: data.costo_fiscal,
      depreciacion_acumulada: data.depreciacion_acumulada,
      reajustes_fiscales: data.reajustes_fiscales,
      observacion: data.observacion?.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDeclaracion(empresaId, declId);
}
