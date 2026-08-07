import { useState } from "react";
import { MapPinOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LinkButton } from "@/components/ui/LinkButton";

// Shown on the Feed page in place of the (empty, out-of-range) real feed —
// see docs/demo-mode-plan.md. Jyo only operates in Tirupati, so a visitor
// outside the 20km radius would otherwise just see an empty grid forever.
export default function OutOfRegionCard() {
  const { startDemo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    setLoading(true);
    setError("");
    try {
      await startDemo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the demo. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center gap-3 border border-border rounded-xl bg-surface px-6 py-10">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10">
        <MapPinOff className="w-5 h-5 text-accent" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">You're outside Jyo's service area</p>
        <p className="text-sm text-subtle max-w-xs">
          Jyo currently only operates within Tirupati. Want to explore how it works with a sandboxed demo instead?
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 max-w-xs">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-px shrink-0" />
          <p className="text-xs text-red-400 leading-snug text-left">{error}</p>
        </div>
      )}

      <LinkButton
        as="button"
        type="button"
        label="Start Demo"
        loading={loading}
        loadingLabel="Starting…"
        disabled={loading}
        onClick={handleStart}
        className="mt-1"
      />
    </div>
  );
}
