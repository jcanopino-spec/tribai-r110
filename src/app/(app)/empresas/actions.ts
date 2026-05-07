"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EmpresaState = { error: string | null };

export async function createEmpresaAction(_prev: EmpresaState, form: FormData): Promise<EmpresaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada." };

  const nit = String(form.get("nit") ?? "").trim();
  const dv = String(form.get("dv") ?? "").trim() || null;
  const razon_social = String(form.get("razon_social") ?? "").trim();
  const ciiu_codigo = String(form.get("ciiu_codigo") ?? "").trim() || null;
  const direccion_seccional_codigo =
    String(form.get("direccion_seccional_codigo") ?? "").trim() || null;
  const regimen_codigo = String(form.get("regimen_codigo") ?? "").trim() || null;

  if (!nit || !razon_social) return { error: "NIT y razón social son obligatorios." };

  const { data, error } = await supabase
    .from("empresas")
    .insert({
      profile_id: user.id,
      nit,
      dv,
      razon_social,
      ciiu_codigo,
      direccion_seccional_codigo,
      regimen_codigo,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.toLowerCase().includes("máximo 20")) {
      return { error: "Ya tienes 20 empresas. Es el límite por cuenta." };
    }
    if (error.code === "23505") {
      return { error: "Ya tienes una empresa registrada con ese NIT." };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(`/empresas/${data.id}`);
}

export async function createDeclaracionAction(empresa_id: string, ano_gravable: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("declaraciones")
    .insert({ empresa_id, ano_gravable, formato: "110", estado: "borrador" })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Already exists — find it
      const { data: existing } = await supabase
        .from("declaraciones")
        .select("id")
        .eq("empresa_id", empresa_id)
        .eq("ano_gravable", ano_gravable)
        .eq("formato", "110")
        .single();
      if (existing) {
        redirect(`/empresas/${empresa_id}/declaraciones/${existing.id}`);
      }
    }
    throw new Error(error.message);
  }

  revalidatePath(`/empresas/${empresa_id}`);
  redirect(`/empresas/${empresa_id}/declaraciones/${data.id}`);
}
