import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-border bg-background",
        "px-3.5 py-2.5 text-sm text-foreground",
        "placeholder:text-subtle",
        "outline-none",
        "transition-[border-color,box-shadow] duration-200 ease-in-out",
        // Was `rgba(235,235,235,0.06)` — a hardcoded copy of the OLD foreground.
      // Token-derived now, so the focus glow can never drift from the palette.
      "focus:border-border-strong focus:ring-[3px] focus:ring-foreground/[0.06]",
        className
      )}
      {...props}
    />
  );
}