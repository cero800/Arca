"use client";

import { MessageSquare } from "lucide-react";
import type { ExplorerComment } from "@/lib/queries";
import { relativeTime } from "@/lib/utils";
import { CommentForm } from "./comment-form";

function Avatar({ name, owner }: { name: string; owner: boolean }) {
  return (
    <span
      className={
        owner
          ? "grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent-soft font-mono text-[10px] font-semibold uppercase text-accent"
          : "grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-surface-3 font-mono text-[10px] font-semibold uppercase text-muted"
      }
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function CommentPanel({
  vaultId,
  assetId,
  comments,
  title,
}: {
  vaultId: string;
  assetId?: string | null;
  comments: ExplorerComment[];
  title: string;
}) {
  const visible = comments.filter((item) =>
    assetId ? item.assetId === assetId : item.assetId === null && item.parentId === null,
  );

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4">
        <h2 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          <MessageSquare className="h-3.5 w-3.5" />
          {title}
          <span className="font-mono text-[10px] text-faint/70">{visible.length}</span>
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {visible.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-line px-3 py-5 text-center">
            <p className="text-[12px] text-muted">Todavía no hay notas aquí.</p>
            <p className="mt-1 text-[11px] text-faint">
              {assetId
                ? "Documenta por qué guardas este archivo."
                : "Describe qué contiene este baúl para tu yo del futuro."}
            </p>
          </div>
        ) : (
          <ol className="space-y-3.5">
            {visible.map((item) => (
              <li key={item.id} className="flex gap-2.5">
                <Avatar name={item.authorName} owner={item.authorKind === "owner"} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[12px] font-medium text-ink">
                      {item.authorName}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-faint">
                      {relativeTime(item.createdAt)}
                    </span>
                    {item.atSecond != null ? (
                      <span className="shrink-0 rounded-full border border-line px-1.5 font-mono text-[9.5px] text-muted">
                        {Math.floor(item.atSecond / 60)}:
                        {String(item.atSecond % 60).padStart(2, "0")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-muted">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="shrink-0 border-t border-line p-3">
        <CommentForm vaultId={vaultId} assetId={assetId ?? undefined} />
      </div>
    </section>
  );
}
