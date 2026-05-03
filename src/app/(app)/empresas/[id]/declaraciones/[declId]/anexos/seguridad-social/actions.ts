"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { State } from "./consts";

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function addSegSocialAction(
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

  const empleado = String(form.get("empleado") ?? "").trim();
  const cedula = String(form.get("cedula") ?? "").trim() || null;
  const salario = parseNum(String(form.get("salario") ?? ""));
  const aporte_salud = parseNum(String(form.get("aporte_salud") ?? ""));
  const aporte_pension = parseNum(String(form.get("aporte_pension") ?? ""));
  const aporte_arl = parseNum(String(form.get("aporte_arl") ?? ""));
  const aporte_parafiscales = parseNum(String(form.get("aporte_parafiscales") ?? ""));
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  if (!empleado) return { error: "Nombre del empleado es obligatorio.", ok: false };

  const { error } = await supabase.from("anexo_seg_social").insert({
    declaracion_id: declId,
    empleado,
    cedula,
    salario,
    aporte_salud,
    aporte_pension,
    aporte_arl,
    aporte_parafiscales,
    observacion,
  });
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteSegSocialAction(id: number, declId: string, empresaId: string) {
  const supabase = await createClient();
  await supabase.from("anexo_seg_social").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}

export async function updateSegSocialAction(
  id: number,
  declId: string,
  empresaId: string,
  data: {
    empleado: string;
    cedula: string | null;
    salario: number;
    aporte_salud: number;
    aporte_pension: number;
    aporte_arl: number;
    aporte_parafiscales: number;
    observacion: string | null;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anexo_seg_social")
    .update({
      empleado: data.empleado.trim(),
      cedula: data.cedula?.trim() || null,
      salario: data.salario,
      aporte_salud: data.aporte_salud,
      aporte_pension: data.aporte_pension,
      aporte_arl: data.aporte_arl,
      aporte_parafiscales: data.aporte_parafiscales,
      observacion: data.observacion?.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDeclaracion(empresaId, declId);
}
