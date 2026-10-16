import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TextFieldProps extends Omit<ComponentProps<"input">, "className"> {
  label: string;
  // Shown under the input in red, and marks the input invalid for screen readers.
  error?: string;
  // Shown under the input when there's no error.
  hint?: string;
  // Sits at the right end of the label row, e.g. a "Forgot password?" link.
  labelAside?: ReactNode;
  className?: string;
}

// 16px text on purpose: iOS Safari zooms the whole page when an input under
// 16px is focused. The focus ring is a box-shadow that is not transitioned,
// so it appears at once.
const INPUT =
  "h-11 w-full rounded-xl bg-raised px-4 text-base text-fg outline-none ring-1 ring-inset ring-fg/[0.08] " +
  "placeholder:text-fg-subtle focus:ring-2 focus:ring-leaf aria-invalid:ring-danger/70 aria-invalid:focus:ring-danger";

export function TextField({
  label,
  error,
  hint,
  labelAside,
  className,
  type = "text",
  id,
  ...input
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-fg">
          {label}
        </label>
        {labelAside}
      </div>

      <div className="relative">
        <input
          id={inputId}
          type={isPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(INPUT, isPassword && "pr-20")}
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex cursor-pointer select-none items-center rounded-r-xl px-4 text-sm font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-leaf"
          >
            {visible ? "Hide" : "Show"}
            <span className="sr-only"> password</span>
          </button>
        )}
      </div>

      {message && (
        <p id={messageId} className={cn("text-[13px] leading-snug", error ? "text-danger" : "text-fg-subtle")}>
          {message}
        </p>
      )}
    </div>
  );
}
