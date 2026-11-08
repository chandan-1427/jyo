import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useV2Theme } from "@/lib/theme";
import { Logo } from "@/components/ui/Logo";
import { textLinkClass } from "@/components/ui/TextLink";

export const LAST_UPDATED = "9 November 2026";
export const CONTACT_EMAIL = "jyofoodsharing@gmail.com";

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="font-display text-xl font-semibold text-balance text-fg sm:text-2xl">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 leading-relaxed text-fg-muted [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-fg [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export function Email() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={textLinkClass}>
      {CONTACT_EMAIL}
    </a>
  );
}

// Plain reading pages, at a comfortable line length, reachable signed in or
// not: the way back depends on which.
export function LegalPage({ title, summary, children }: { title: string; summary: ReactNode; children: ReactNode }) {
  useV2Theme();
  const { user } = useAuth();

  return (
    <div className="min-h-dvh bg-canvas text-fg">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo className="font-display text-2xl text-fg [&>span]:text-leaf" />
        <Link
          to={user ? "/feed" : "/"}
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {user ? "Back to Jyo" : "Home"}
        </Link>
      </header>

      <main className="mx-auto max-w-[68ch] px-4 pt-8 pb-20 sm:px-6 sm:pt-12">
        <h1 className="font-display text-3xl font-semibold leading-tight text-balance sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-fg-subtle">Last updated {LAST_UPDATED}</p>

        <div className="mt-8 rounded-2xl bg-raised p-5 leading-relaxed text-fg-muted ring-1 ring-inset ring-fg/[0.06] sm:p-6">
          <p className="mb-2 font-medium text-fg">In short</p>
          {summary}
        </div>

        <div className="mt-10 flex flex-col gap-10">{children}</div>
      </main>
    </div>
  );
}
