"use client";

import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { signInAction, type LoginState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signInAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          placeholder="tu@correo.com"
        />
      </Field>

      <Field label="Contraseña">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••"
        />
      </Field>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-[9px] border border-danger/25 bg-danger/10 px-3 py-2 text-[12.5px] text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        className="h-10 w-full"
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Entrando…
          </>
        ) : (
          <>
            Entrar
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
