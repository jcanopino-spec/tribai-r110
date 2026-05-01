"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveValoresState = {
  error: string | null;
  saved: number;
  savedAt: string | null;
};

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
    const text = String(raw ?? "").replace(/\./g, "").replace(/,/g, ".");
    const valor = text === "" ? 0 : Number(text);
    if (!Number.isFinite(valor) || !Number.isInteger(numero)) continue;
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
