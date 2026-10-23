import { useEffect, useId, useState, type ChangeEvent } from "react";
import { ImagePlus, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImagePickerFieldProps {
  label: string;
  // Called with the chosen file, or null when it's removed.
  onChange: (file: File | null) => void;
  hint?: string;
  error?: string;
  className?: string;
}

const OVERLAY_BUTTON =
  "flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-canvas/85 px-3 text-sm font-medium text-fg backdrop-blur-sm transition-colors hover:bg-canvas " +
  "focus-visible:outline-2 focus-visible:outline-leaf";

// A large photo picker for when the photo is the heart of the form (posting
// food). Empty, the whole 4:3 tile picks a photo; once chosen it shows the
// photo with Change and Remove over it. No `capture`, so phones offer the
// camera or the gallery rather than forcing one.
export function ImagePickerField({ label, onChange, hint, error, className }: ImagePickerFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const [preview, setPreview] = useState("");

  // Object URLs hold the image in memory until revoked.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared, so choosing the same file again still fires a change.
    e.target.value = "";
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onChange(file);
  };

  const remove = () => {
    setPreview("");
    onChange(null);
  };

  const input = (
    <input
      id={id}
      type="file"
      accept="image/*"
      onChange={handleChange}
      aria-invalid={error ? true : undefined}
      aria-describedby={error || hint ? messageId : undefined}
      className="sr-only"
    />
  );

  const frame = cn(
    "relative aspect-[4/3] overflow-hidden rounded-2xl bg-raised ring-1 ring-inset",
    error ? "ring-danger/70" : "ring-fg/[0.08]"
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-fg">{label}</span>

      {preview ? (
        <div className={frame}>
          <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute right-3 bottom-3 flex gap-2">
            <label htmlFor={id} className={cn(OVERLAY_BUTTON, "has-[:focus-visible]:outline-2")}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Change
              {input}
            </label>
            <button type="button" onClick={remove} className={cn(OVERLAY_BUTTON, "hover:text-danger")}>
              <X className="size-4" aria-hidden="true" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={cn(
            frame,
            "group grid cursor-pointer place-items-center text-center transition-colors hover:bg-lifted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-leaf"
          )}
        >
          <span className="flex flex-col items-center gap-3 px-6">
            <span className="grid size-14 place-items-center rounded-2xl bg-lifted text-fg-muted transition-colors group-hover:text-fg">
              <ImagePlus className="size-6" aria-hidden="true" />
            </span>
            <span className="font-medium text-fg">Add a photo of the food</span>
            <span className="text-sm text-fg-subtle">Take one now, or choose one you have.</span>
          </span>
          {input}
        </label>
      )}

      {(error || hint) && (
        <p id={messageId} className={cn("text-[13px] leading-snug", error ? "text-danger" : "text-fg-subtle")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
