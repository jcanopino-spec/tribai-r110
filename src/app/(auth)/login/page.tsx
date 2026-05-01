"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { signInAction, type AuthState } from "../actions";

const initial: AuthState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInAction, initial);

  return (
    <div>
      <h1 className="font-serif text-3xl leading-[1.1] tracking-[-0.02em]">Entrar a Tribai</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Aún no tienes cuenta?{" "}
        <Link href="/registro" className="underline-offset-4 hover:underline">
          Regístrate
        </Link>
        .
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <Field label="Correo">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña" error={state.error}>
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
