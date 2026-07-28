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
        // Visually identical to LinkButton's primary variant, but deliberately
        // NOT imported from it — see the note above; this must not depend on
        // anything that could be what crashed. Previously an arbitrary-value
        // #F2F0EC fill with #1B1A19 label text, the latter a copy-paste of the
        // old --color-background. Tokenised so the duplication can no longer
        // drift out of sync with the palette.
        className="mt-1 inline-flex items-center justify-center text-sm font-semibold tracking-tight px-6 py-2.5 rounded-lg bg-foreground hover:bg-white active:scale-[0.97] text-background cursor-pointer transition-all duration-150 ease-out shadow-sm hover:shadow-md"
      >
        Reload Jyo
      </button>
    </div>
  );
}
