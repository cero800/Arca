"use client";

import { useActionState, useEffect, useState } from "react";
import { Delete, File, Loader2, Trash2, Undo2 } from "lucide-react";
import type { TrashedAsset } from "@/lib/queries";
import {
  emptyTrashAction,
  purgeAssetAction,
  restoreAssetAction,
} from "@/lib/actions/assets";
import { Button } from "@/components/ui/button";

type TrashListProps = {
  vaultId: string;
  assets: TrashedAsset[];
};

export function TrashList({ vaultId, assets }: TrashListProps) {
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  const [emptyState, emptyAction, emptyPending] = useActionState(
    emptyTrashAction,
    null,
  );

  useEffect(() => {
    if (emptyState?.ok) setConfirmingEmpty(false);
  }, [emptyState]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          {assets.length} {assets.length === 1 ? "archivo borrado" : "archivos borrados"}
        </p>

        <div hidden={!confirmingEmpty} className="flex items-center gap-2">
          <form action={emptyAction}>
            <input type="hidden" name="vaultId" value={vaultId} />
            <Button type="submit" variant="danger" size="sm" disabled={emptyPending}>
              {emptyPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Sí, vaciar
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingEmpty(false)}
            disabled={emptyPending}
          >
            Cancelar
          </Button>
        </div>

        <Button
          type="button"
          variant="danger"
          size="sm"
          hidden={confirmingEmpty}
          disabled={assets.length === 0}
          onClick={() => setConfirmingEmpty(true)}
        >
          <Trash2 className="h-3 w-3" />
          Vaciar papelera
        </Button>
      </div>

      {emptyState?.error ? (
        <p role="alert" className="text-[11.5px] text-danger">
          {emptyState.error}
        </p>
      ) : null}

      {assets.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {assets.map((asset) => (
            <TrashAssetRow key={asset.id} asset={asset} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TrashAssetRow({ asset }: { asset: TrashedAsset }) {
  const [confirmingPurge, setConfirmingPurge] = useState(false);
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreAssetAction,
    null,
  );
  const [purgeState, purgeAction, purgePending] = useActionState(
    purgeAssetAction,
    null,
  );

  const error = restoreState?.error ?? purgeState?.error;

  return (
    <li className="grid gap-3 rounded-[12px] border border-line bg-surface-1 p-3.5">
      <div className="flex items-start gap-4">
        <File className="mt-0.5 h-6 w-6 shrink-0 text-faint" strokeWidth={1.5} />

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[13px] font-medium text-ink">{asset.name}</p>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-faint">
            <span>{asset.kind.toUpperCase()}</span>
            <span>{formatBytes(asset.size)}</span>
            <span>Eliminado {relativeTime(asset.deletedAt)}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={restoreAction}>
          <input type="hidden" name="id" value={asset.id} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={restorePending || purgePending}
            className="h-7 gap-1.5 text-[11px] text-muted"
          >
            {restorePending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Undo2 className="h-3 w-3" />
            )}
            Restaurar
          </Button>
        </form>

        {confirmingPurge ? null : (
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={restorePending || purgePending}
            onClick={() => setConfirmingPurge(true)}
            className="h-7 gap-1.5 text-[11px]"
          >
            <Delete className="h-3 w-3" />
            Eliminar
          </Button>
        )}

        <div hidden={!confirmingPurge} className="flex items-center gap-2">
          <form action={purgeAction}>
            <input type="hidden" name="id" value={asset.id} />
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={restorePending || purgePending}
              className="h-7 gap-1.5 text-[11px]"
            >
              {purgePending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Delete className="h-3 w-3" />
              )}
              Sí, eliminar
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingPurge(false)}
            disabled={purgePending}
            className="h-7 text-[11px] text-faint"
          >
            Cancelar
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[11.5px] text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-[140px] place-items-center rounded-[12px] border border-dashed border-line bg-surface-1/40 p-8">
      <p className="text-center text-[12.5px] leading-relaxed text-muted">
        No hay archivos en la papelera.
        <br />
        Los elementos que borres aparecerán aquí.
      </p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  if (bytes <= 0) return "0 B";
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}
