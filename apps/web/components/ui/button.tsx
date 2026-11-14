import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-[#3f7ee8] active:bg-[#3a74d6] border border-white/10 shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_8px_24px_-12px_rgb(76_141_255/0.9)]",
  secondary:
    "bg-surface-2 text-ink border border-line hover:bg-surface-3 hover:border-line-strong",
  ghost:
    "bg-transparent text-muted hover:bg-white/[0.05] hover:text-ink border border-transparent",
  danger:
    "bg-danger/10 text-danger border border-danger/25 hover:bg-danger/15 hover:border-danger/40",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5 rounded-[7px]",
  md: "h-9 px-4 text-[13px] gap-2 rounded-[9px]",
  icon: "h-9 w-9 rounded-[9px] justify-center",
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
