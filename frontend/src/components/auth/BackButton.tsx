import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  className?: string;
}

export function BackButton({ className }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={cn(
        "cursor-pointer absolute top-0 right-0 flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground transition-colors",
        className
      )}
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back
    </button>
  );
}