"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { CornerDownLeft, Loader2 } from "lucide-react";
import { createCommentAction, type CommentState } from "@/lib/actions/comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

export function CommentForm({
  vaultId,
  assetId,
  atSecond,
  placeholder = "Escribe una nota…",
}: {
  vaultId: string;
  assetId?: string | null;
  atSecond?: number | null;
  placeholder?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<CommentState, FormData>(
    createCommentAction,
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    router.refresh();
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="vaultId" value={vaultId} />
      {assetId ? <input type="hidden" name="assetId" value={assetId} /> : null}
      {atSecond != null ? (
        <input type="hidden" name="atSecond" value={String(atSecond)} />
      ) : null}

      <Textarea
        name="body"
        rows={2}
        required
        maxLength={4000}
        placeholder={placeholder}
        className="min-h-[64px] text-[12.5px]"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />

      {state?.error ? (
        <p role="alert" className="text-[11.5px] text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-faint">⌘ + Enter</span>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CornerDownLeft className="h-3 w-3" />
          )}
          Comentar
        </Button>
      </div>
    </form>
  );
}
