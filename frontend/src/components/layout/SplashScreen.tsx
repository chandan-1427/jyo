import { Logo } from "../ui/Logo";

export default function SplashScreen() {
  return (
    // No background of its own: it inherits the page's, so it matches both
    // the redesigned pages and the ones still on the old palette.
    <div className="min-h-screen font-medium tracking-wide flex flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <Logo />

        <p className="text-sm text-subtle tracking-wide">
          Loading...
        </p>
      </div>
    </div>
  );
}