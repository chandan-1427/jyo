import { cn } from "@/lib/utils";

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  // Size and text size, e.g. "size-8 text-sm".
  className?: string;
}

// A person's photo, or the first letter of their name when there isn't one.
export function Avatar({ name, src, className }: AvatarProps) {
  const initial = name?.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-lifted font-semibold text-fg",
        className
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
