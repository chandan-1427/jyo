// Deliberately self-contained, plain HTML only — no react-router Link or
// useNavigate. This renders when something crashed badly enough to reach
// the top-level error boundary, which sits outside BrowserRouter, so it
// must work even if the router itself is what broke.
export function ErrorFallback() {
  return (
    <div className="min-h-screen bg-background font-medium tracking-wide flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="font-geist font-semibold text-[1.1rem] text-foreground tracking-tight">
        Jyo<span className="text-accent">.</span>
      </span>

      <div className="flex flex-col items-center gap-1.5">
        <p className="text-sm font-medium text-muted">Something went wrong</p>
        <p className="text-sm text-subtle max-w-xs">
          The app hit an unexpected error. Reloading usually fixes it.
        </p>
      </div>

      <button
        onClick={() => window.location.assign("/")}
        className="mt-1 inline-flex items-center justify-center text-sm font-semibold tracking-tight px-6 py-2.5 rounded-lg bg-[#F2F0EC] hover:bg-white active:scale-[0.97] text-[#1B1A19] cursor-pointer transition-all duration-150 ease-out shadow-sm hover:shadow-md"
      >
        Reload Jyo
      </button>
    </div>
  );
}
