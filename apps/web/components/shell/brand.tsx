import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      <rect
        x="3.25"
        y="4.25"
        width="17.5"
        height="15.5"
        rx="4.25"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M3.6 9.4h16.8" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="14.55" r="1.45" fill="currentColor" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-[9px] border border-line-strong bg-surface-2 text-ink hairline">
        <LogoMark className="h-[18px] w-[18px]" />
      </span>
      <span className="font-display text-[19px] font-semibold leading-none tracking-[-0.04em] text-ink">
        arca
      </span>
    </span>
  );
}
