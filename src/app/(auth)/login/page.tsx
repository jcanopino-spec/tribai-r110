"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { signInAction, type AuthState } from "../actions";

const initial: AuthState = { error: null };

function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initial);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";

  return (
    <div>
      <h1 className="font-serif text-3xl leading-[1.1] tracking-[-0.02em]">
        Entrar a Tribai
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Aún no tienes cuenta?{" "}
        <Link href="/registro" className="underline-offset-4 hover:underline">
          Regístrate
        </Link>
        .
      </p>

      {next ? (
        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-300">
          Tu sesión expiró · vuelve a entrar y serás llevado de regreso a tu
          descarga automáticamente.
        </p>
      ) : null}

      <form action={formAction} className="mt-8 space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
