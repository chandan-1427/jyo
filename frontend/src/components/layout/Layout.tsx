import { Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import Navbar from "./Navbar";
import DemoIndicator from "./DemoIndicator";

// Shell for every logged-in page. Full width with the same side gutters as
// the navbar, so content lines up under the logo; each page arranges its own
// columns rather than being boxed into a narrow centre. Bottom padding on
// phones clears the floating tab bar (56px, sitting 12px up or just above
// the home indicator, plus 16px of air); while the demo indicator is
// showing, extra room keeps it from covering the last thing on the page.
// It's kept in --page-pb so `fill-screen` (index.css) can size a page to
// exactly the space left on screen.
export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main
        className={cn(
          "px-4 pt-6 pb-(--page-pb) sm:px-6 lg:px-10",
          user?.isDemo
            ? "[--page-pb:calc(10rem+env(safe-area-inset-bottom))] sm:[--page-pb:7rem]"
            : "[--page-pb:calc(max(0.75rem,env(safe-area-inset-bottom))+4.5rem)] sm:[--page-pb:3rem]"
        )}
      >
        <Outlet />
      </main>
      <DemoIndicator />
    </div>
  );
}
