"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RENGLONES_COMPUTADOS } from "@/lib/forms/form110-compute";

export type SaveValoresState = {
  error: string | null;
  saved: number;
  savedAt: string | null;
};

export async function setModoCargaAction(
  declId: string,
  empresaId: string,
  modo: "manual" | "balance",
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("declaraciones")
    .update({ modo_carga: modo, updated_at: new Date().toISOString() })
    .eq("id", declId);
  if (error) throw new Error(error.message);

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  if (modo === "balance") {
    redirect(`/empresas/${empresaId}/declaraciones/${declId}/importar`);
  }
  redirect(`/empresas/${empresaId}/declaraciones/${declId}`);
}

export async function clearModoCargaAction(declId: string, empresaId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("declaraciones")
    .update({ modo_carga: null, updated_at: new Date().toISOString() })
    .eq("id", declId);
  if (error) throw new Error(error.message);

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  redirect(`/empresas/${empresaId}/declaraciones/${declId}`);
}

export async function saveValoresAction(
  declId: string,
  empresaId: string,
  _prev: SaveValoresState,
  form: FormData,
): Promise<SaveValoresState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada.", saved: 0, savedAt: null };

  const valores: { declaracion_id: string; numero: number; valor: number }[] = [];
  for (const [key, raw] of form.entries()) {
    if (!key.startsWith("v_")) continue;
    const numero = Number(key.slice(2));
    if (!Number.isInteger(numero)) continue;
    if (RENGLONES_COMPUTADOS.has(numero)) continue; // los computados no se guardan
    const text = String(raw ?? "").replace(/\./g, "").replace(/,/g, ".");
    const valor = text === "" ? 0 : Number(text);
    if (!Number.isFinite(valor)) continue;
    valores.push({ declaracion_id: declId, numero, valor });
  }

  if (valores.length === 0) {
    return { error: "Sin valores para guardar.", saved: 0, savedAt: null };
  }

  const { error } = await supabase
    .from("form110_valores")
    .upsert(valores, { onConflict: "declaracion_id,numero" });

  if (error) return { error: error.message, saved: 0, savedAt: null };

  // Touch declaration updated_at
  await supabase
    .from("declaraciones")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", declId);

  revalidatePath(`/empresas/${empresaId}/declaraciones/${declId}`);
  return { error: null, saved: valores.length, savedAt: new Date().toISOString() };
}
