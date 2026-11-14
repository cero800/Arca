"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2 } from "lucide-react";
import {
  createGuestCommentAction,
  type GuestCommentState,
} from "@/lib/actions/guest-comments";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";

const NAME_KEY = "arca-guest-name";

/** Formulario de notas para quien recibe un enlace con permiso de comentar. */
export function GuestCommentForm({
  shareToken,
  assetId,
}: {
  shareToken: string;
  assetId?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [state, formAction, pending] = useActionState<GuestCommentState, FormData>(
    createGuestCommentAction,
    null,
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(NAME_KEY);
    if (stored) setName(stored);
  }, []);

  useEffect(() => {
    if (!state?.ok) return;
    if (name.trim()) window.localStorage.setItem(NAME_KEY, name.trim());
    setBody("");
    router.refresh();
  }, [state, name, router]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="shareToken" value={shareToken} />
      {assetId ? <input type="hidden" name="assetId" value={assetId} /> : null}

      <Input
        name="name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (event.target.value.trim()) {
            window.localStorage.setItem(NAME_KEY, event.target.value.trim());
          }
        }}
        required
        minLength={2}
        maxLength={60}
        placeholder="Tu nombre"
        aria-label="Tu nombre"
        className="h-8 text-[12px]"
      />

      <Textarea
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={2}
        required
        maxLength={4000}
        placeholder="Escribe una nota…"
        aria-label="Tu comentario"
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

      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10px] text-faint">
          Invitado · ⌘ + Enter
        </span>
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
