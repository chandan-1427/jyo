import { cn } from "../../lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-neutral-200 bg-neutral-50",
        "px-3.5 py-2.5 text-sm text-neutral-900",
        "placeholder:text-neutral-400",
        "outline-none resize-none",
        "transition-[border-color,background-color,box-shadow] duration-200 ease-in-out",
        "focus:border-neutral-300 focus: focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]",
        className
      )}
      {...props}
    />
  );
}