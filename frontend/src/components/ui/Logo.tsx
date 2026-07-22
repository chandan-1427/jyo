import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

interface LogoProps {
  to?: string;
  className?: string;
}

export function Logo({ to = "/", className }: LogoProps) {
  return (
    <Link
      to={to}
      className={cn(
        "font-geist font-semibold text-[1.1rem] text-foreground tracking-tight",
        className
      )}
    >
      Jyo<span className="text-accent">.</span>
    </Link>
  );
}