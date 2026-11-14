"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  createVaultAction,
  updateVaultAction,
  type VaultFormState,
} from "@/lib/actions/vaults";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

export function VaultForm({
  mode,
  vault,
}: {
  mode: "create" | "edit";
  vault?: { id: string; name: string; description: string; slug: string };
}) {
  const [state, formAction, pending] = useActionState<VaultFormState, FormData>(
    mode === "create" ? createVaultAction : updateVaultAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      {mode === "edit" && vault ? <input type="hidden" name="id" value={vault.id} /> : null}

      <Field label="Nombre" hint="Se usa para la URL del baúl.">
        <Input
          name="name"
          defaultValue={vault?.name ?? ""}
          autoFocus
          required
          maxLength={80}
          placeholder="Fotos de familia, Referencias, Archivo 2025…"
        />
      </Field>

      <Field label="Descripción" hint="Opcional. Para tu yo del futuro.">
        <Textarea
          name="description"
          defaultValue={vault?.description ?? ""}
          rows={4}
          maxLength={500}
          placeholder="Qué guarda este baúl y por qué importa."
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

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {mode === "create" ? "Crear baúl" : "Guardar cambios"}
        </Button>
        <Link
          href={vault ? `/v/${vault.slug}` : "/"}
          className="inline-flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-[13px] text-muted transition-colors hover:bg-white/5 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Cancelar
        </Link>
      </div>
    </form>
  );
}
