import { useState } from "react";
import { MapPinOff, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";

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
    <EmptyState
      icon={<MapPinOff />}
      title="You're outside Tirupati"
      actions={
        <Button
          onClick={handleStart}
          loading={loading}
          iconLeft={<Sparkles className="size-4" aria-hidden="true" />}
        >
          {loading ? "Starting…" : "Try the demo"}
        </Button>
      }
    >
      <p>Jyo only works within 20 km of Tirupati for now. You can still try it with sample posts in demo mode.</p>
      {error && <Notice tone="error" className="mt-5">{error}</Notice>}
    </EmptyState>
  );
}
