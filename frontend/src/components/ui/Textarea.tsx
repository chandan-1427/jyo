import { cn } from "../../lib/utils";

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
        "focus:border-neutral-600 focus:shadow-[0_0_0_3px_rgba(235,235,235,0.06)]",
        className
      )}
      {...props}
    />
  );
}