import { Loader2, CheckCircle2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationStatusProps {
  loading: boolean;
  coords: { lat: number; lng: number } | null;
}

export function LocationStatus({ loading, coords }: LocationStatusProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm border",
        loading && "bg-surface border-border text-subtle",
        !loading && coords && "bg-surface border-border text-muted",
        !loading && !coords && "bg-red-950/30 border-red-900/40 text-red-400"
      )}
    >
      {loading ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> Detecting your location…</>
      ) : coords ? (
        <><CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" /> Location detected</>
      ) : (
        <><MapPin className="w-3.5 h-3.5 shrink-0" /> Location unavailable</>
      )}
    </div>
  );
}