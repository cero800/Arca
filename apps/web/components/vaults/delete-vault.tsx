"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { deleteVaultAction, type VaultFormState } from "@/lib/actions/vaults";
import { Button } from "@/components/ui/button";

export function DeleteVault({
  vault,
}: {
  vault: { id: string; name: string; slug: string };
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<VaultFormState, FormData>(
    deleteVaultAction,
    null,
  );

  return (
    <div className="rounded-[12px] border border-danger/20 bg-danger/[0.04] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger/80" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-medium text-ink">Eliminar este baúl</h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            Se eliminarán <strong className="font-medium text-ink">todos los archivos</strong> de
            «{vault.name}», sus derivados y sus notas. Esta acción no se puede deshacer.
          </p>

          {state?.error ? (
            <p role="alert" className="mt-2 text-[11.5px] text-danger">
              {state.error}
            </p>
          ) : null}

          <form action={formAction} className="mt-3">
            <input type="hidden" name="id" value={vault.id} />
            {confirming ? (
              <div className="flex items-center gap-2">
                <Button type="submit" variant="danger" size="sm" disabled={pending}>
                  {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Sí, eliminar todo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setConfirming(true)}
              >
                Eliminar baúl
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
