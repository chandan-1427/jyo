import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-border bg-background",
        "px-3.5 py-2.5 text-sm text-foreground",
        "placeholder:text-subtle",
        "outline-none resize-none",
        "transition-[border-color,box-shadow] duration-200 ease-in-out",
        // Kept byte-identical to Input.tsx's focus treatment on purpose — the
      // two must stay indistinguishable in a form.
      "focus:border-border-strong focus:ring-[3px] focus:ring-foreground/[0.06]",
        className
      )}
      {...props}
    />
  );
}