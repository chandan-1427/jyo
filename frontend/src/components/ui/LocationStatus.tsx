import { Loader2, CheckCircle2, MapPin } from "lucide-react";
import { cn } from "../../lib/utils";

interface LocationStatusProps {
  loading: boolean;
  coords: { lat: number; lng: number } | null;
}

export function LocationStatus({ loading, coords }: LocationStatusProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm border",
        loading && "bg-neutral-50 border-neutral-100 text-neutral-400",
        !loading && coords && "bg-white border-neutral-100 text-neutral-600",
        !loading && !coords && "bg-red-50 border-red-100 text-red-500"
      )}
    >
      {loading ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> Detecting your location…</>
      ) : coords ? (
        <><CheckCircle2 className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" /> Location detected</>
      ) : (
        <><MapPin className="w-3.5 h-3.5 shrink-0" /> Location unavailable</>
      )}
    </div>
  );
}