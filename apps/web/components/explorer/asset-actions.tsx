"use client";

import { useActionState, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { trashAssetAction, type AssetActionState } from "@/lib/actions/assets";
import { Button } from "@/components/ui/button";

/** Mueve el archivo abierto a la papelera, con confirmación explícita. */
export function TrashAssetButton({
  assetId,
  assetName,
}: {
  assetId: string;
  assetName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<AssetActionState, FormData>(
    trashAssetAction,
    null,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Mover a la papelera"
        title="Mover a la papelera"
        className="grid h-7 w-7 place-items-center rounded-[6px] text-faint transition-colors hover:bg-white/5 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {confirming ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="arca-trash-title"
            className="w-full max-w-[380px] rounded-[14px] border border-line bg-surface-1 p-5 shadow-panel"
          >
            <h2 id="arca-trash-title" className="text-[14px] font-medium text-ink">
              ¿Mover a la papelera?
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              «{assetName}» saldrá del baúl. Puedes restaurarlo desde la papelera; los
              archivos no se borran hasta que la vacíes.
            </p>

            {state?.error ? (
              <p role="alert" className="mt-2 text-[11.5px] text-danger">
                {state.error}
              </p>
            ) : null}

            <form action={formAction} className="mt-4 flex items-center justify-end gap-2">
              <input type="hidden" name="id" value={assetId} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="danger" size="sm" disabled={pending}>
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Mover a papelera
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
