"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  ShieldOff,
} from "lucide-react";
import {
  createShareLinkAction,
  revokeShareLinkAction,
  type ShareActionState,
} from "@/lib/actions/share";
import type { ShareLinkSummary } from "@/lib/queries";
import { cn, relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function roleLabel(role: "viewer" | "commenter"): string {
  return role === "commenter" ? "Puede comentar" : "Solo lectura";
}

export function ShareLinks({
  vaultId,
  links,
}: {
  vaultId: string;
  links: ShareLinkSummary[];
}) {
  const [state, action, pending] = useActionState<ShareActionState, FormData>(
    createShareLinkAction,
    null,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="vaultId" value={vaultId} />

        <label className="block">
          <span className="mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
            Permiso
          </span>
          <select
            name="role"
            defaultValue="viewer"
            className="h-9 w-full rounded-[8px] border border-line bg-bg/60 px-2.5 text-[12.5px] text-ink transition-colors hover:border-line-strong focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="viewer">Solo lectura</option>
            <option value="commenter">Puede comentar</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
            Caduca
          </span>
          <select
            name="days"
            defaultValue="0"
            className="h-9 w-full rounded-[8px] border border-line bg-bg/60 px-2.5 text-[12.5px] text-ink transition-colors hover:border-line-strong focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="0">Nunca</option>
            <option value="7">En 7 días</option>
            <option value="30">En 30 días</option>
            <option value="90">En 90 días</option>
          </select>
        </label>

        <Button type="submit" size="sm" variant="secondary" disabled={pending} className="h-9">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
          Crear enlace
        </Button>
      </form>

      {state?.error ? (
        <p role="alert" className="text-[11.5px] text-danger">
          {state.error}
        </p>
      ) : null}

      {state?.ok && state.url ? (
        <div className="rounded-[10px] border border-accent/25 bg-accent/[0.06] p-3">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">
            Enlace {state.role ? roleLabel(state.role) : ""} creado
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={state.url}
              aria-label="Enlace para compartir"
              onFocus={(event) => event.currentTarget.select()}
              className="h-8 min-w-0 flex-1 rounded-[7px] border border-line bg-bg/70 px-2 font-mono text-[10.5px] text-muted focus:border-accent/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(state.url ?? "").then(() => setCopied(true));
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[7px] border border-line text-faint transition-colors hover:border-line-strong hover:text-ink"
              aria-label="Copiar enlace"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-ok" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            <a
              href={state.url}
              target="_blank"
              rel="noreferrer"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[7px] border border-line text-faint transition-colors hover:border-line-strong hover:text-ink"
              aria-label="Abrir enlace"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
            Cópialo ahora: por seguridad guardamos solo un hash y no podemos
            mostrarlo otra vez.
          </p>
        </div>
      ) : null}

      {links.length === 0 ? (
        <p className="rounded-[9px] border border-dashed border-line px-3 py-4 text-center text-[11.5px] text-faint">
          Aún no has creado enlaces para este baúl.
        </p>
      ) : (
        <ul className="divide-y divide-line/60 rounded-[10px] border border-line">
          {links.map((link) => (
            <ShareLinkRow key={link.id} link={link} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShareLinkRow({ link }: { link: ShareLinkSummary }) {
  const [state, action, pending] = useActionState<ShareActionState, FormData>(
    revokeShareLinkAction,
    null,
  );

  const expired =
    Boolean(link.expiresAt) && new Date(link.expiresAt ?? "").getTime() <= Date.now();
  const active = !link.revokedAt && !expired;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          active ? "bg-ok" : "bg-faint/50",
        )}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-ink">{roleLabel(link.role)}</p>
        <p className="mt-0.5 font-mono text-[10px] text-faint">
          Creado {relativeTime(link.createdAt)}
          {link.expiresAt ? ` · caduca el ${formatDate(link.expiresAt)}` : " · sin caducidad"}
        </p>
      </div>

      <span
        className={cn(
          "shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em]",
          active ? "text-ok" : "text-faint",
        )}
      >
        {link.revokedAt ? "Revocado" : expired ? "Caducado" : "Activo"}
      </span>

      {active ? (
        <form action={action}>
          <input type="hidden" name="id" value={link.id} />
          <button
            type="submit"
            disabled={pending}
            className="flex h-7 items-center gap-1.5 rounded-[6px] border border-line px-2 text-[10.5px] text-faint transition-colors hover:border-danger/30 hover:text-danger disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ShieldOff className="h-3 w-3" />
            )}
            Revocar
          </button>
        </form>
      ) : null}

      {state?.error ? (
        <p role="alert" className="w-full text-[10.5px] text-danger">
          {state.error}
        </p>
      ) : null}
    </li>
  );
}
