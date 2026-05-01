"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return { error: "Correo y contraseña son obligatorios." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: traducirError(error.message) };
  }
  redirect("/dashboard");
}

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const nombre = String(form.get("nombre") ?? "").trim();

  if (!email || !password) return { error: "Correo y contraseña son obligatorios." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });
  if (error) {
    return { error: traducirError(error.message) };
  }
  redirect("/registro/confirmar");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function traducirError(msg: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "User already registered": "Ya existe una cuenta con ese correo.",
    "Email not confirmed": "Aún no has confirmado tu correo. Revisa tu bandeja.",
  };
  return map[msg] ?? msg;
}
