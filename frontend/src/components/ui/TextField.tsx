import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  // Shown under the input in red, and marks the input invalid for screen readers.
  error?: string;
  // Shown under the input when there's no error.
  hint?: string;
  // Sits at the right end of the label row, e.g. a "Forgot password?" link.
  labelAside?: ReactNode;
  // Small icon inside the start of the field. It ignores clicks, so clicking
  // it focuses the field like clicking anywhere else in it.
  icon?: ReactNode;
  className?: string;
}

const ICON = "pointer-events-none absolute left-4 flex text-fg-subtle [&>svg]:size-[18px]";

// 16px text on purpose: iOS Safari zooms the whole page when an input under
// 16px is focused. The focus ring is a box-shadow that is not transitioned,
// so it appears at once. The fill is `raised` on the page; a container that is
// itself `raised` sets --field-bg so its fields stay visible against it.
const CONTROL =
  "w-full rounded-xl bg-[var(--field-bg,var(--color-raised))] px-4 text-base text-fg outline-none ring-1 ring-inset ring-fg/[0.08] " +
  "placeholder:text-fg-subtle focus:ring-2 focus:ring-leaf aria-invalid:ring-danger/70 aria-invalid:focus:ring-danger";

// Ids that wire the label to the control and the control to its message.
function useFieldIds(id: string | undefined, hasMessage: boolean) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const messageId = `${controlId}-message`;
  return { controlId, messageId, describedBy: hasMessage ? messageId : undefined };
}

// Label row, the control, and the hint/error line under it.
function FieldFrame({
  label,
  labelAside,
  controlId,
  messageId,
  error,
  hint,
  className,
  children,
}: FieldProps & { controlId: string; messageId: string; children: ReactNode }) {
  const message = error ?? hint;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={controlId} className="text-sm font-medium text-fg">
          {label}
        </label>
        {labelAside}
      </div>
      {children}
      {message && (
        <p id={messageId} className={cn("text-[13px] leading-snug", error ? "text-danger" : "text-fg-subtle")}>
          {message}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = FieldProps &
  Omit<ComponentProps<"input">, "className" | "size"> & {
    // md (44px) fits the compact auth forms; lg (48px) is for roomier pages.
    size?: "md" | "lg";
  };

export function TextField({
  label,
  error,
  hint,
  labelAside,
  icon,
  size = "md",
  className,
  type = "text",
  id,
  ...input
}: TextFieldProps) {
  const ids = useFieldIds(id, Boolean(error ?? hint));
  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);

  return (
    <FieldFrame {...{ label, error, hint, labelAside, className }} controlId={ids.controlId} messageId={ids.messageId}>
      <div className="relative flex items-center">
        {icon && <span className={ICON} aria-hidden="true">{icon}</span>}
        <input
          id={ids.controlId}
          type={isPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cn(CONTROL, size === "lg" ? "h-12" : "h-11", icon && "pl-11", isPassword && "pr-20")}
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
    </FieldFrame>
  );
}

type TextAreaFieldProps = FieldProps & Omit<ComponentProps<"textarea">, "className">;

export function TextAreaField({ label, error, hint, labelAside, icon, className, id, rows = 4, ...textarea }: TextAreaFieldProps) {
  const ids = useFieldIds(id, Boolean(error ?? hint));

  return (
    <FieldFrame {...{ label, error, hint, labelAside, className }} controlId={ids.controlId} messageId={ids.messageId}>
      <div className="relative">
        {/* Pinned to the first line of text rather than centred. */}
        {icon && <span className={cn(ICON, "top-3.5")} aria-hidden="true">{icon}</span>}
        <textarea
          id={ids.controlId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cn(CONTROL, "block resize-none py-3 leading-relaxed", icon && "pl-11")}
          {...textarea}
        />
      </div>
    </FieldFrame>
  );
}
