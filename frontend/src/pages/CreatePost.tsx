import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, X, Clock, AlertCircle } from "lucide-react";
import { apiFetch } from "../lib/api";
import { uploadImage } from "../lib/supabase";
import { getCurrentLocation, type Coords } from "../lib/location";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { LinkButton } from "../components/ui/LinkButton";
import { LocationStatus } from "../components/ui/LocationStatus";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns current datetime in "YYYY-MM-DDTHH:MM" format for min attribute
function nowLocal(): string {
  const now = new Date();
  // Get local time components
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-[13px] font-medium text-neutral-700">{label}</label>
        {hint && <span className="text-[12px] text-neutral-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CreatePost() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    description: "",
    pickupWindowStart: nowLocal(),
    pickupWindowEnd: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentLocation()
      .then(setCoords)
      .catch(() => setError("Could not detect your location. Please enable location access."))
      .finally(() => setLocLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // If start changes, clear end if it's now invalid
      if (name === "pickupWindowStart" && next.pickupWindowEnd && next.pickupWindowEnd <= value) {
        next.pickupWindowEnd = "";
      }
      return next;
    });
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!coords) {
      setError("Location is required to post food. Please enable location access.");
      return;
    }
    if (!photoFile) {
      setError("Please add a photo of the food.");
      return;
    }

    const start = new Date(form.pickupWindowStart).toISOString();
    const end = new Date(form.pickupWindowEnd).toISOString();

    if (new Date(end) <= new Date(start)) {
      setError("Pickup end time must be after start time.");
      return;
    }

    setLoading(true);
    try {
      const photoUrl = await uploadImage(photoFile, "food-photos");
      await apiFetch("/posts", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          photoUrl,
          pickupLat: coords.lat,
          pickupLng: coords.lng,
          pickupWindowStart: start,   // ← IST converted
          pickupWindowEnd: end,       // ← IST converted
        }),
      });
      navigate("/my-posts");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const minStart = nowLocal();
  const minEnd = form.pickupWindowStart || minStart;

return (
  <div className="max-w-5xl mx-auto px-6 py-1 font-medium tracking-wide">

    {/* Page header */}
    <div className="mb-8">
      <p className="text-sm text-neutral-400 mb-1">Share with your community</p>
      <h1 className="font-semibold text-2xl text-neutral-900 tracking-tight">Post Food</h1>
    </div>

    {/* Error */}
    {error && (
      <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
        <AlertCircle className="w-4 h-4 text-red-500 mt-px shrink-0" />
        <p className="text-sm text-red-600 leading-snug">{error}</p>
      </div>
    )}

    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-lg">

      {/* Photo upload */}
      <Field label="Food Photo">
        {photoPreview ? (
          <div className="relative rounded-xl overflow-hidden border border-neutral-100">
            <img src={photoPreview} alt="Food preview" className="w-full h-52 object-cover" />
            <button
              type="button"
              onClick={clearPhoto}
              className="cursor-pointer absolute top-2.5 right-2.5 bg-white border border-neutral-200 rounded-full p-1 text-neutral-500 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-52 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 cursor-pointer hover:bg-white hover:border-neutral-300 transition-colors duration-150 group">
            <Camera className="w-6 h-6 text-neutral-300 group-hover:text-neutral-400 transition-colors mb-2" />
            <span className="text-sm text-neutral-400 group-hover:text-neutral-500 transition-colors">
              Tap to add a food photo
            </span>
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
          </label>
        )}
      </Field>

      {/* Title */}
      <Field label="Food Title">
        <Input
          name="title"
          type="text"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. Rice and dal for 2"
          required
        />
      </Field>

      {/* Description */}
      <Field label="Description" hint="optional">
        <Textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Details about the food, quantity, allergens..."
          rows={3}
        />
      </Field>

      {/* Pickup window */}
      <Field label="Pickup Window">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-neutral-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> From
            </span>
            <Input
              name="pickupWindowStart"
              type="datetime-local"
              value={form.pickupWindowStart}
              onChange={handleChange}
              min={minStart}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-neutral-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> To
            </span>
            <Input
              name="pickupWindowEnd"
              type="datetime-local"
              value={form.pickupWindowEnd}
              onChange={handleChange}
              min={minEnd}
              required
            />
          </div>
        </div>
      </Field>

      {/* Location status */}
      <LocationStatus loading={locLoading} coords={coords} />

      {/* Submit */}
      <LinkButton
        as="button"
        type="submit"
        label={loading ? "Posting…" : "Post Food"}
        disabled={loading || !coords}
        loading={loading}
        loadingLabel="Posting…"
        className="mt-1 w-full"
      />

    </form>
  </div>
);
}