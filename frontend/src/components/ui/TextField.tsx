import { useId, useRef, useState, type ComponentProps, type ReactNode, type Ref } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { playTypingSound } from "@/lib/typingSounds";
import { useInputFormat, type InputFormat } from "@/lib/inputFormat";
import { LiveText } from "./LiveText";

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
// Number inputs drop the browser's up/down arrows: the values here (like
// minutes) are typed, and the tiny arrows only cluttered the field.
const CONTROL =
  "w-full rounded-xl bg-[var(--field-bg,var(--color-raised))] px-4 text-base text-fg outline-none ring-1 ring-inset ring-fg/[0.08] " +
  "placeholder:text-fg-subtle focus:ring-2 focus:ring-leaf aria-invalid:ring-danger/70 aria-invalid:focus:ring-danger " +
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// Ids that wire the label to the control and the control to its message.
function useFieldIds(id: string | undefined, hasMessage: boolean) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const messageId = `${controlId}-message`;
  return { controlId, messageId, describedBy: hasMessage ? messageId : undefined };
}

// Label row, the control, and the hint/error line under it. Exported for
// fields with their own control, such as DateTimeField.
export function FieldFrame({
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

// LiveText needs the cursor and selection, which browsers don't expose for
// type="email" or type="number" (selectionStart is null), so those render
// as text inputs that keep their type's keyboard and typing behaviour.
const AS_TEXT: Partial<Record<string, ComponentProps<"input">>> = {
  email: { inputMode: "email", autoCapitalize: "none", autoCorrect: "off", spellCheck: false },
  number: { inputMode: "numeric" },
};

// The app's number fields are all whole numbers.
const FORMATS: Partial<Record<string, InputFormat>> = { number: "digits", tel: "phone", email: "email" };

function useFieldRef<T>(ref: Ref<T> | undefined) {
  const own = useRef<T>(null);
  const attach = (node: T | null) => {
    own.current = node;
    setRef(ref, node);
  };
  return [own, attach] as const;
}

function setRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
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
  ref,
  maxLength,
  ...input
}: TextFieldProps) {
  const ids = useFieldIds(id, Boolean(error ?? hint));
  const isPassword = type === "password";
  const asText = AS_TEXT[type];
  const format = FORMATS[type];
  const [visible, setVisible] = useState(false);
  const [inputRef, attachRef] = useFieldRef(ref);
  // Applied by useInputFormat after cleaning, not as the input's maxLength.
  const limit =
    maxLength ??
    (type === "number" && input.max != null ? String(input.max).length : format === "phone" ? 10 : undefined);
  useInputFormat(inputRef, format, limit);
  const padding = cn("px-4", icon && "pl-11", isPassword && "pr-20");
  const mono = isPassword && "font-mono placeholder:font-inter";

  return (
    <FieldFrame {...{ label, error, hint, labelAside, className }} controlId={ids.controlId} messageId={ids.messageId}>
      <div className="relative flex items-center">
        {icon && <span className={ICON} aria-hidden="true">{icon}</span>}
        <input
          ref={attachRef}
          id={ids.controlId}
          type={(isPassword && visible) || asText ? "text" : type}
          {...asText}
          maxLength={format ? undefined : maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cn(CONTROL, "live-input", size === "lg" ? "h-12" : "h-11", padding, mono)}
          {...input}
        />
        <LiveText
          fieldRef={inputRef}
          password={isPassword}
          masked={isPassword && !visible}
          padding={padding}
          className={cn("text-base", mono)}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => {
              setVisible(!visible);
              playTypingSound(visible ? "conceal" : "reveal");
            }}
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

// The frame (fill, edge, focus and error rings) is drawn by a wrapper, with
// the textarea sitting 2px inside it. A textarea paints its scrollbar over
// its own edge, so when the ring was on the textarea, a long text's
// scrollbar covered the right-hand side of it. The height stays at `rows`
// lines and longer text scrolls inside, so typing never moves anything below.
const TEXTAREA_FRAME =
  "relative rounded-xl bg-[var(--field-bg,var(--color-raised))] p-0.5 ring-1 ring-inset ring-fg/[0.08] " +
  "focus-within:ring-2 focus-within:ring-leaf " +
  "has-[[aria-invalid=true]]:ring-danger/70 has-[[aria-invalid=true]]:focus-within:ring-danger";

export function TextAreaField({ label, error, hint, labelAside, icon, className, id, rows = 4, ref, ...textarea }: TextAreaFieldProps) {
  const ids = useFieldIds(id, Boolean(error ?? hint));
  const [textareaRef, attachRef] = useFieldRef(ref);
  // Padding is 2px less than an input's, making up for the frame's.
  const padding = cn("px-3.5 py-2.5", icon && "pl-[42px]");

  return (
    <FieldFrame {...{ label, error, hint, labelAside, className }} controlId={ids.controlId} messageId={ids.messageId}>
      <div className={TEXTAREA_FRAME}>
        {/* Pinned to the first line of text rather than centred. */}
        {icon && <span className={cn(ICON, "top-3.5")} aria-hidden="true">{icon}</span>}
        <textarea
          ref={attachRef}
          id={ids.controlId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cn(
            "live-input block w-full resize-none rounded-[10px] bg-transparent text-base leading-relaxed text-fg outline-none placeholder:text-fg-subtle",
            padding
          )}
          {...textarea}
        />
        <LiveText fieldRef={textareaRef} multiline padding={padding} className="text-base leading-relaxed" />
      </div>
    </FieldFrame>
  );
}

interface SearchFieldProps extends Omit<ComponentProps<"input">, "className" | "value" | "onChange" | "type"> {
  value: string;
  onChange: (value: string) => void;
  // Read by screen readers; the placeholder says it visually.
  label: string;
  className?: string;
  // 14px text beside 14px controls (a table's toolbar). Phones keep 16px,
  // so iOS Safari doesn't zoom in when it's focused.
  compact?: boolean;
}

// A search box in the same style as the other fields: a search icon, and a
// clear button once something's typed. Escape clears it too. The browser's
// own clear "x" is hidden so there's only one.
export function SearchField({ value, onChange, label, className, compact, placeholder = "Search", ref, ...input }: SearchFieldProps) {
  const [inputRef, attachRef] = useFieldRef(ref);
  const padding = cn("pr-11 pl-11", compact && "sm:pl-10");
  const font = cn("text-base", compact && "sm:text-sm");

  return (
    <div role="search" className={cn("relative flex items-center", className)}>
      <span className={cn(ICON, compact && "sm:[&>svg]:size-4")} aria-hidden="true">
        <Search />
      </span>
      <input
        ref={attachRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        aria-label={label}
        placeholder={placeholder}
        className={cn(CONTROL, "live-input h-11 [&::-webkit-search-cancel-button]:appearance-none", padding, font)}
        {...input}
      />
      <LiveText fieldRef={inputRef} padding={padding} className={font} />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 grid size-8 cursor-pointer place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-lifted hover:text-fg focus-visible:outline-2 focus-visible:outline-leaf"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
