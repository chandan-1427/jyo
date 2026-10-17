import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useHideOnScroll } from "@/lib/useHideOnScroll";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

// The logged-out top bar for the home and auth pages. It never links to the
// page you are already on.
export function SiteHeader() {
  const hidden = useHideOnScroll();
  const { pathname } = useLocation();

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
          {pathname !== "/login" && (
            <Button to="/login" variant={pathname === "/register" ? "secondary" : "ghost"} size="sm">
              Log in
            </Button>
          )}
          {pathname !== "/register" && (
            <Button to="/register" variant={pathname === "/login" ? "secondary" : "primary"} size="sm">
              Sign up
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
