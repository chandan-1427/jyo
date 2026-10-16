import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useHideOnScroll } from "@/lib/useHideOnScroll";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

// The logged-out top bar, shared by the home and auth pages so it sits in
// exactly the same place on each: same height, same logo position, same two
// buttons. The button for the page you're on stays put and is marked as
// current, rather than disappearing and shifting the other one.
export function SiteHeader() {
  const hidden = useHideOnScroll();
  const { pathname } = useLocation();
  const current = (path: string) => (pathname === path ? "page" : undefined);

  return (
    // Hides while scrolling down, returns on scroll up; keyboard focus
    // inside it always brings it back.
    <header
      className={cn(
        "sticky top-0 z-40 shrink-0 bg-canvas transition-transform duration-300 ease-out focus-within:translate-y-0 motion-reduce:transition-none",
        hidden && "-translate-y-full"
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo className="font-display text-2xl text-fg [&>span]:text-leaf" />
        <nav aria-label="Account" className="flex items-center gap-1 sm:gap-2">
          <Button
            to="/login"
            variant="ghost"
            size="sm"
            aria-current={current("/login")}
            className="aria-[current=page]:bg-raised aria-[current=page]:text-fg"
          >
            Log in
          </Button>
          <Button to="/register" size="sm" aria-current={current("/register")}>
            Sign up
          </Button>
        </nav>
      </div>
    </header>
  );
}
