"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { signUpAction, type AuthState } from "../actions";

const initial: AuthState = { error: null };

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState(signUpAction, initial);

  return (
    <div>
      <h1 className="font-serif text-3xl leading-[1.1] tracking-[-0.02em]">Crear cuenta</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ya tienes cuenta?{" "}
        <Link href="/login" className="underline-offset-4 hover:underline">
          Entrar
        </Link>
        .
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <Field label="Nombre">
          <Input name="nombre" autoComplete="name" required />
        </Field>
        <Field label="Correo">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña" error={state.error}>
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creando…" : "Crear cuenta"}
        </Button>
      </form>
    </div>
  );
}
