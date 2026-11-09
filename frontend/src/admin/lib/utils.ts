import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The admin portal's own Tailwind build uses the "ad" prefix (admin.css), so
// its classes never collide with the rest of Jyo's; tailwind-merge has to
// know the prefix to merge them.
const twMerge = extendTailwindMerge({ prefix: "ad" });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
