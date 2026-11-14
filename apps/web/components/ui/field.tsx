import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[9px] border border-line bg-bg/60 px-3 text-[13.5px] text-ink",
        "placeholder:text-faint",
        "transition-colors duration-150 hover:border-line-strong focus:border-accent/60 focus:bg-bg focus:outline-none",
        "focus:ring-2 focus:ring-accent/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-[9px] border border-line bg-bg/60 px-3 py-2.5 text-[13.5px] leading-relaxed text-ink",
        "placeholder:text-faint",
        "transition-colors duration-150 hover:border-line-strong focus:border-accent/60 focus:bg-bg focus:outline-none",
        "focus:ring-2 focus:ring-accent/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-faint",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1.5 text-[11.5px] text-faint">{hint}</p> : null}
    </div>
  );
}
