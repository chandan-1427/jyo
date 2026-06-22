import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-neutral-200 bg-neutral-50",
        "px-3.5 py-2.5 text-sm text-neutral-900",
        "placeholder:text-neutral-400",
        "outline-none",
        "transition-[border-color,background-color,box-shadow] duration-200 ease-in-out",
        "focus:border-neutral-300 focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]",
        className
      )}
      {...props}
    />
  );
}