import { Link, type LinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

// Underlined link inside running text. Exported as a class string too, for
// the odd in-text <button> that needs to look the same (e.g. "Sign up again").
export const textLinkClass =
  "rounded-sm font-medium text-fg underline decoration-fg/25 underline-offset-4 transition-colors " +
  "hover:decoration-fg/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf";

export function TextLink({ className, ...props }: LinkProps) {
  return <Link {...props} className={cn(textLinkClass, className)} />;
}
