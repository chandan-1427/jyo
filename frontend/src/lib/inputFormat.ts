import { useEffect, type RefObject } from "react";

// Number and email fields are text inputs (see AS_TEXT in TextField), so
// nothing else keeps letters out of them. The length limit is applied after
// cleaning rather than with maxLength, which would cut a pasted
// "+91 98765 43210" to "+91 98765 " before it could be cleaned.

export type InputFormat = "digits" | "phone" | "email";

const KEEP: Record<InputFormat, (text: string) => string> = {
  digits: (text) => text.replace(/\D/g, ""),
  phone: (text) => text.replace(/\D/g, ""),
  email: (text) => text.replace(/\s/g, ""),
};

// Only for a number arriving whole (paste, autofill): a typed 11th digit
// after a leading 0 shouldn't silently drop the 0.
function wholePhone(digits: string) {
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

// setRangeText bypasses the `value` setter, so React's change tracking
// still sees a change when the dispatched input event arrives.
function replace(field: HTMLInputElement, value: string, caret: number, inputType: string, data: string | null) {
  field.setRangeText(value, 0, field.value.length, "end");
  field.setSelectionRange(caret, caret);
  field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data }));
}

export function useInputFormat(
  ref: RefObject<HTMLInputElement | null>,
  format: InputFormat | undefined,
  maxLength: number | undefined
) {
  useEffect(() => {
    const field = ref.current;
    if (!field || !format) return;
    const keep = KEEP[format];
    const limit = (value: string) => (maxLength ? value.slice(0, maxLength) : value);

    const onBeforeInput = (event: InputEvent) => {
      const { inputType } = event;
      if (!inputType.startsWith("insert") || event.isComposing) return;
      const raw = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
      if (!raw) return;

      const clean = keep(raw);
      const start = field.selectionStart ?? field.value.length;
      const end = field.selectionEnd ?? field.value.length;
      const joined = field.value.slice(0, start) + clean + field.value.slice(end);
      const whole = clean.length > 1 && format === "phone" ? wholePhone(joined) : joined;
      const next = limit(whole);

      if (clean === raw && next === joined) return;
      event.preventDefault();
      if (next === field.value) return;
      const caret = whole === joined ? Math.min(start + clean.length, next.length) : next.length;
      replace(field, next, caret, inputType, clean);
    };

    // Autofill and Android keyboards' composed text skip beforeinput.
    const tidy = (event: Event) => {
      if ((event as InputEvent).isComposing) return;
      const { value } = field;
      const cleaned = keep(value);
      const next = limit(format === "phone" ? wholePhone(cleaned) : cleaned);
      if (next === value) return;
      const caretBefore = keep(value.slice(0, field.selectionStart ?? value.length)).length;
      replace(field, next, Math.min(caretBefore, next.length), "insertReplacementText", null);
    };

    field.addEventListener("beforeinput", onBeforeInput);
    field.addEventListener("input", tidy);
    field.addEventListener("compositionend", tidy);
    return () => {
      field.removeEventListener("beforeinput", onBeforeInput);
      field.removeEventListener("input", tidy);
      field.removeEventListener("compositionend", tidy);
    };
  }, [ref, format, maxLength]);
}
