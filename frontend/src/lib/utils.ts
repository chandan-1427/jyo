import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
// For a group of buttons people click in quick succession (zoom, steppers,
// month arrows): a fast second click would otherwise make the browser select
// the nearest word, often a heading nearby. Only the repeat click is
// cancelled, so the first click still focuses the button as normal.
export function preventDoubleClickSelection(e: { detail: number; preventDefault: () => void }) {
  if (e.detail > 1) e.preventDefault();
}
