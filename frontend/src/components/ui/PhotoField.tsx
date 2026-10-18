import { useEffect, useId, useState, type ChangeEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PhotoFieldProps {
  // Field label above the tile, e.g. "A selfie". Optional: the tile's own
  // text names the action, which is enough on its own in a short form.
  label?: string;
  // Tile text before and after a photo is chosen, e.g. "Take a selfie" / "Retake selfie".
  emptyText: string;
  chosenText: string;
  // The second line, explaining why or what happens.
  hint: string;
  // A photo already saved, shown until a new one is chosen.
  currentUrl?: string | null;
  // Shown in the thumbnail when there's no photo yet.
  icon: ReactNode;
  // Opens the camera directly on phones: "user" is the front camera.
  capture?: "user" | "environment";
  error?: string;
  onSelect: (file: File) => void;
}

// A tappable tile for picking one photo, with a thumbnail of the current or
// newly chosen one. The whole tile is the input's label, so tapping anywhere
// opens the picker and the (visually hidden) input stays keyboard-reachable.
export function PhotoField({ label, emptyText, chosenText, hint, currentUrl, icon, capture, error, onSelect }: PhotoFieldProps) {
  const id = useId();
  const [preview, setPreview] = useState("");

  // Object URLs hold the image in memory until revoked.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared, so choosing the same file again still fires a change.
    e.target.value = "";
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onSelect(file);
  };

  const shown = preview || currentUrl;

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-fg">{label}</span>}
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-center gap-4 rounded-xl bg-[var(--field-bg,var(--color-raised))] p-3 ring-1 ring-inset transition-colors hover:bg-lifted",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-leaf",
          error ? "ring-danger/70" : "ring-fg/[0.08]"
        )}
      >
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-lifted text-fg-muted [&>svg]:size-6">
          {shown ? <img src={shown} alt="" className="size-full object-cover" /> : icon}
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-fg">{shown ? chosenText : emptyText}</span>
          <span className="block text-sm text-fg-subtle">{hint}</span>
        </span>
        <input
          id={id}
          type="file"
          accept="image/*"
          capture={capture}
          onChange={handleChange}
          aria-invalid={error ? true : undefined}
          className="sr-only"
        />
      </label>
      {error && <p className="text-[13px] leading-snug text-danger">{error}</p>}
    </div>
  );
}
