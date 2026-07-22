import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, X, Clock, AlertCircle } from "lucide-react";
import { apiFetch, ApiError } from "../lib/api";
import { uploadImage } from "../lib/supabase";
import { getCurrentLocation, type Coords } from "../lib/location";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { LinkButton } from "../components/ui/LinkButton";
import { LocationStatus } from "../components/ui/LocationStatus";
import { Field } from "../components/ui/Field";
import { DateTimePicker } from "../components/ui/DateTimePicker";

function nowLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

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
          pickupWindowStart: start,
          pickupWindowEnd: end,
        }),
      });
      navigate("/my-posts");
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const minStart = nowLocal();
  const minEnd = form.pickupWindowStart || minStart;

  return (
    <div className="px-6 py-8 font-medium tracking-wide">

      {/* Page header */}
      <div className="mb-8">
        <p className="text-sm text-subtle mb-1">Share with your community</p>
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">Post Food</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_1.1fr] gap-8 items-start">

        {/* Left — photo */}
        <div className="lg:sticky lg:top-20">
          <Field label="Food Photo">
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={photoPreview} alt="Food preview" className="w-full h-80 lg:h-96 object-cover" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="cursor-pointer absolute top-2.5 right-2.5 bg-surface border border-border rounded-full p-1 text-muted hover:text-red-400 hover:border-red-900/40 transition-colors shadow-sm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-80 lg:h-96 rounded-xl border border-dashed border-border bg-surface cursor-pointer hover:bg-surface/60 hover:border-neutral-600 transition-colors duration-150 group">
                <Camera className="w-6 h-6 text-subtle group-hover:text-muted transition-colors mb-2" />
                <span className="text-sm text-subtle group-hover:text-muted transition-colors">
                  Tap to add a food photo
                </span>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
              </label>
            )}
          </Field>
        </div>

        {/* Right — form fields */}
        <div className="flex flex-col gap-5">

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

          <Field label="Description" hint="optional">
            <Textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Details about the food, quantity, allergens..."
              rows={4}
            />
          </Field>

<Field label="Pickup Window">
  <div className="grid grid-cols-2 gap-3">
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-subtle flex items-center gap-1">
        <Clock className="w-3 h-3" /> From
      </span>
      <DateTimePicker
        value={form.pickupWindowStart}
        onChange={(val) =>
          handleChange({ target: { name: "pickupWindowStart", value: val } } as any)
        }
        min={minStart}
      />
    </div>
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-subtle flex items-center gap-1">
        <Clock className="w-3 h-3" /> To
      </span>
      <DateTimePicker
        value={form.pickupWindowEnd}
        onChange={(val) =>
          handleChange({ target: { name: "pickupWindowEnd", value: val } } as any)
        }
        min={minEnd}
      />
    </div>
  </div>
</Field>

          <LocationStatus loading={locLoading} coords={coords} />

          <LinkButton
            as="button"
            type="submit"
            label={loading ? "Posting…" : "Post Food"}
            disabled={loading || !coords}
            loading={loading}
            loadingLabel="Posting…"
            className="mt-1 w-full"
          />

        </div>
      </form>
    </div>
  );
}