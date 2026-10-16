import type { ReactNode } from "react";
import { useV2Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/layout/SiteHeader";

type IconTone = "leaf" | "danger" | "muted";

const ICON_TONES: Record<IconTone, string> = {
  leaf: "text-leaf",
  danger: "text-danger",
  muted: "text-fg-muted",
};

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  // For result screens ("Check your email", "Email verified"): shown above the title.
  icon?: ReactNode;
  iconTone?: IconTone;
  // Line under the form linking to the other auth page, e.g. "New to Jyo? Sign up".
  footer?: ReactNode;
  children?: ReactNode;
}

// Shared shell for every auth page: one narrow column, sized so the tallest
// page (sign up, four fields) fits a 1366x768 laptop screen without
// scrolling. It still scrolls rather than clipping when an error notice or a
// very small screen needs more room. Phones start the column near the top so
// the keyboard doesn't push the form off screen; larger screens centre it.
export function AuthLayout({ title, description, icon, iconTone = "leaf", footer, children }: AuthLayoutProps) {
  useV2Theme();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-fg">
      <SiteHeader />

      <main className="flex w-full flex-1 justify-center px-4 py-6 sm:items-center sm:px-6">
        <div className="w-full max-w-sm">
          {icon && (
            <div className={cn("mb-5 grid size-11 place-items-center rounded-2xl bg-raised", ICON_TONES[iconTone])}>
              {icon}
            </div>
          )}
          <h1 className="font-display text-2xl font-semibold leading-tight sm:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1.5 leading-relaxed text-fg-muted">{description}</p>}
          <div className="mt-6">{children}</div>
          {footer && <p className="mt-6 text-center text-sm text-fg-subtle">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
