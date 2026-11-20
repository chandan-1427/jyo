import type { ComponentProps } from "react";
import { playTypingSound } from "@/lib/typingSounds";

// For a choice card: the surrounding <label> styles itself with `has-[:checked]:`.
export function Radio({ onChange, ...input }: Omit<ComponentProps<"input">, "type" | "className">) {
  return (
    <>
      <input
        type="radio"
        className="peer sr-only"
        onChange={(event) => {
          playTypingSound("radio");
          onChange?.(event);
        }}
        {...input}
      />
      <span
        aria-hidden="true"
        className="grid size-4 shrink-0 place-items-center rounded-full ring-[1.5px] ring-inset ring-fg/30 peer-checked:ring-leaf after:size-2 after:scale-0 after:rounded-full after:bg-leaf after:transition-transform after:duration-150 after:content-[''] peer-checked:after:scale-100 motion-reduce:after:transition-none"
      />
    </>
  );
}
