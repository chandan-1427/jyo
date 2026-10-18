import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const MARK =
  "pointer-events-none size-3.5 scale-50 text-canvas opacity-0 transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none";

interface CheckboxProps extends Omit<ComponentProps<"input">, "type"> {
  // Text beside the box. Without it, the box needs an aria-label, or a label
  // around it (e.g. a whole card that toggles it).
  label?: ReactNode;
  // Some but not all of a group selected ("Select all" with a partial pick).
  indeterminate?: boolean;
}

// A native checkbox drawn in the app's style: the real input stays (so
// keyboard, forms and screen readers work as usual) with its look replaced.
export function Checkbox({ label, indeterminate = false, className, ...input }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  // There's no HTML attribute for this state; it can only be set from script.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = (
    <span className="relative grid size-5 shrink-0 place-items-center">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-md bg-canvas ring-1 ring-inset ring-fg/25 transition-colors",
          "checked:bg-leaf checked:ring-leaf indeterminate:bg-leaf indeterminate:ring-leaf",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        )}
        {...input}
      />
      <Check strokeWidth={3} className={cn(MARK, "relative peer-checked:scale-100 peer-checked:opacity-100")} aria-hidden="true" />
      <Minus strokeWidth={3} className={cn(MARK, "absolute peer-indeterminate:scale-100 peer-indeterminate:opacity-100")} aria-hidden="true" />
    </span>
  );

  if (!label) return box;
  return (
    <label className={cn("inline-flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-fg", className)}>
      {box}
      {label}
    </label>
  );
}
