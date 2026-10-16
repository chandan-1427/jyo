import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, X, Clock, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { createPostSchema } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { uploadImage } from "@/lib/supabase";
import { getCurrentLocation, type Coords } from "@/lib/location/location";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LinkButton } from "@/components/ui/LinkButton";
import { LocationStatus } from "@/components/ui/LocationStatus";
import { Field } from "@/components/ui/Field";
import { DateTimePicker } from "@/components/ui/DateTimePicker";

function nowLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

type PostValues = {
  title: string;
  description: string;
  photo: File;
  pickupWindowStart: string;
  pickupWindowEnd: string;
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-400">{message}</p> : null;
}

export default function CreatePost() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, watch, setError, formState: { errors } } = useZodForm(createPostSchema, {
    title: "",
    description: "",
    pickupWindowStart: nowLocal(),
    pickupWindowEnd: "",
  });
  const pickupWindowStart = watch("pickupWindowStart");
  const pickupWindowEnd = watch("pickupWindowEnd");

  const [photoPreview, setPhotoPreview] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [formError, setFormError] = useState("");

  const createMutation = useMutation<unknown, Error, PostValues>({
    mutationFn: async (values) => {
      const photoUrl = await uploadImage(values.photo, "food-photos");

      return apiFetch("/posts", {
        method: "POST",
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          photoUrl,
          pickupLat: coords!.lat,
          pickupLng: coords!.lng,
          pickupWindowStart: new Date(values.pickupWindowStart).toISOString(),
          pickupWindowEnd: new Date(values.pickupWindowEnd).toISOString(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      navigate("/my-posts");
    },
    onError: (err) => {
      applyServerFieldErrors(err, setError, ["title", "description", "pickupWindowEnd"]);
    },
  });

  const loading = createMutation.isPending;
  // Field-level server errors show under their fields; anything else up top.
  const fieldLevel = Object.values(errors).some((e) => e?.type === "server");
  const error = formError || (!fieldLevel ? createMutation.error?.message ?? "" : "");

  useEffect(() => {
    getCurrentLocation()
      .then(setCoords)
      .catch(() => setFormError("Could not detect your location. Please enable location access."))
      .finally(() => setLocLoading(false));
  }, []);

  const setStart = (value: string) => {
    setValue("pickupWindowStart", value, { shouldValidate: true });
    // An end time that is no longer after the new start is cleared, as before.
    if (pickupWindowEnd && pickupWindowEnd <= value) setValue("pickupWindowEnd", "");
  };

  const setEnd = (value: string) => {
    setValue("pickupWindowEnd", value, { shouldValidate: true });
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValue("photo", file, { shouldValidate: true });
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setValue("photo", undefined as unknown as File, { shouldValidate: true });
    setPhotoPreview("");
  };

  const onSubmit = handleSubmit((values) => {
    setFormError("");
    if (!coords) {
      setFormError("Location is required to post food. Please enable location access.");
      return;
    }
    createMutation.mutate(values);
  });

  const minStart = nowLocal();
  const minEnd = pickupWindowStart || minStart;

  return (
    <div className="px-6 py-8 font-medium tracking-wide">

      {/* Page header */}
      <div className="mb-8">
        <p className="text-sm text-subtle mb-1">Share with your community</p>
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">Post Food</h1>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{error}</p>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="grid lg:grid-cols-[1fr_1.1fr] gap-8 items-start">

        {/* Left — photo */}
        <div className="lg:sticky lg:top-20">
          <Field label="Food Photo">
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={photoPreview} alt="Food preview" className="w-full h-80 lg:h-96 object-cover" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  aria-label="Remove photo"
                  className="cursor-pointer absolute top-2.5 right-2.5 bg-surface border border-border rounded-full p-1 text-muted hover:text-red-400 hover:border-red-900/40 transition-colors shadow-sm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-80 lg:h-96 rounded-xl border border-dashed border-border bg-surface cursor-pointer hover:border-border-strong transition-colors duration-150 group">
                <Camera className="w-6 h-6 text-subtle group-hover:text-muted transition-colors mb-2" />
                <span className="text-sm text-subtle group-hover:text-muted transition-colors">
                  Tap to add a food photo
                </span>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
              </label>
            )}
            <FieldError message={errors.photo?.message} />
          </Field>
        </div>

        {/* Right — form fields */}
        <div className="flex flex-col gap-5">

          <Field label="Food Title">
            <Input
              type="text"
              placeholder="e.g. Rice and dal for 2"
              aria-invalid={errors.title ? true : undefined}
              {...register("title")}
            />
            <FieldError message={errors.title?.message} />
          </Field>

          <Field label="Description" hint="optional">
            <Textarea
              placeholder="Details about the food, quantity, allergens..."
              rows={4}
              aria-invalid={errors.description ? true : undefined}
              {...register("description")}
            />
            <FieldError message={errors.description?.message} />
          </Field>

          <Field label="Pickup Window">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-subtle flex items-center gap-1">
                  <Clock className="w-3 h-3" /> From
                </span>
                <DateTimePicker value={pickupWindowStart} onChange={setStart} min={minStart} />
                <FieldError message={errors.pickupWindowStart?.message} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-subtle flex items-center gap-1">
                  <Clock className="w-3 h-3" /> To
                </span>
                <DateTimePicker value={pickupWindowEnd} onChange={setEnd} min={minEnd} />
                <FieldError message={errors.pickupWindowEnd?.message} />
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
