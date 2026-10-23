import { Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import Navbar from "./Navbar";
import DemoIndicator from "./DemoIndicator";

// Shell for every logged-in page. Full width with the same side gutters as
// the navbar, so content lines up under the logo; each page arranges its own
// columns rather than being boxed into a narrow centre. Bottom padding on
// phones clears the floating tab bar (56px, sitting 12px up or just above
// the home indicator); while
// the demo indicator is showing, extra room keeps it from covering the last
// thing on the page.
export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main
        className={cn(
          "px-4 pt-6 sm:px-6 lg:px-10",
          user?.isDemo
            ? "pb-[calc(10rem+env(safe-area-inset-bottom))] sm:pb-28"
            : "pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-12"
        )}
      >
        <Outlet />
      </main>
      <DemoIndicator />
    </div>
  );
}
