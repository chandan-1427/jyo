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
        "font-geist font-semibold text-[1.1rem] text-neutral-900 tracking-tight",
        className
      )}
    >
      Jyo<span className="text-[#2D6A4F]">.</span>
    </Link>
  );
}