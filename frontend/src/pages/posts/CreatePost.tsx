import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller } from "react-hook-form";
import { Loader2, MapPin, MapPinOff, Send } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { createPostSchema, MAX_PICKUP_DAYS_AHEAD } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { toDateTimeInput } from "@/lib/format";
import { uploadImage } from "@/lib/supabase";
import { useV2Theme } from "@/lib/theme";
import { getCurrentLocation, type Coords } from "@/lib/location/location";
import { Button } from "@/components/ui/Button";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextAreaField, TextField } from "@/components/ui/TextField";

type PostValues = {
  title: string;
  description: string;
  photo: File;
  pickupWindowStart: string;
  pickupWindowEnd: string;
};

const HOUR = 3_600_000;
const SLOT = 5 * 60_000;

// Pickup starts at the next 5-minute slot and runs two hours by default, so
// most people only nudge the times rather than pick both from scratch.
function defaultWindow() {
  const start = new Date(Math.ceil((Date.now() + 60_000) / SLOT) * SLOT);
  return { start: toDateTimeInput(start), end: toDateTimeInput(new Date(start.getTime() + 2 * HOUR)) };
}

export default function CreatePost() {
  useV2Theme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Fixed when the page opens, like the times' limits below.
  const [{ start, end, latest }] = useState(() => ({
    ...defaultWindow(),
    latest: toDateTimeInput(new Date(Date.now() + MAX_PICKUP_DAYS_AHEAD * 24 * HOUR)),
  }));

  const { register, control, handleSubmit, setValue, watch, setError, formState: { errors } } = useZodForm(createPostSchema, {
    title: "",
    description: "",
    pickupWindowStart: start,
    pickupWindowEnd: end,
  });
  const pickupStart = watch("pickupWindowStart");

  // The pickup spot is wherever the poster is now.
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState("");
  const fetchLocation = useCallback(() => {
    getCurrentLocation()
      .then(setCoords)
      .catch((err: unknown) => setLocationError(err instanceof Error ? err.message : "We couldn't get your location."))
      .finally(() => setLocating(false));
  }, []);
  useEffect(fetchLocation, [fetchLocation]);
  const locate = () => {
    setLocating(true);
    setLocationError("");
    fetchLocation();
  };

  const create = useMutation<unknown, Error, PostValues>({
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
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      navigate("/my-posts");
    },
    onError: (err) => {
      applyServerFieldErrors(err, setError, ["title", "description", "pickupWindowEnd"]);
    },
  });

  // Field-level server errors show under their fields; anything else here
  // (e.g. "outside the service area").
  const fieldLevel = Object.values(errors).some((e) => e?.type === "server");
  const error = !fieldLevel ? create.error?.message ?? "" : "";

  const onSubmit = handleSubmit((values) => coords && create.mutate(values));
  const now = toDateTimeInput(new Date());

  return (
    <div className="text-fg">
      <PageHeader title="Post food" subtitle="Share what you have with someone nearby." />

      {error && <Notice tone="error" className="mb-6">{error}</Notice>}

      <form onSubmit={onSubmit} noValidate className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
        <ImagePickerField
          label="Photo"
          hint="A clear photo helps people decide."
          error={errors.photo?.message}
          onChange={(file) => setValue("photo", file ?? (undefined as unknown as File), { shouldValidate: true })}
        />

        <div className="flex flex-col gap-5">
          <TextField label="What are you sharing?" placeholder="e.g. Rice and dal for 2" error={errors.title?.message} {...register("title")} />

          <TextAreaField
            label="Description"
            labelAside={<span className="text-sm text-fg-subtle">Optional</span>}
            placeholder="How much there is, when it was made, anything to know (spicy, contains nuts…)"
            rows={4}
            error={errors.description?.message}
            {...register("description")}
          />

          {/* Nothing in the past, nothing more than a week out, and the end
              no earlier than the start. */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={control}
              name="pickupWindowStart"
              render={({ field }) => (
                <DateTimeField
                  label="Pickup starts"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  min={now}
                  max={latest}
                  error={errors.pickupWindowStart?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="pickupWindowEnd"
              render={({ field }) => (
                <DateTimeField
                  label="Pickup ends"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  min={pickupStart > now ? pickupStart : now}
                  max={latest}
                  error={errors.pickupWindowEnd?.message}
                />
              )}
            />
          </div>

          {/* Where it's picked up from, and who gets to see that. */}
          {locating ? (
            <Notice>
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Finding your location for the pickup spot…
              </span>
            </Notice>
          ) : coords ? (
            <div className="flex gap-3 rounded-xl bg-raised px-4 py-3.5 text-sm leading-relaxed text-fg-muted ring-1 ring-inset ring-fg/[0.06]">
              <MapPin className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden="true" />
              <p>
                <span className="font-medium text-fg">Pickup spot: where you are now.</span> Only the person you approve
                sees it.
              </p>
            </div>
          ) : (
            <Notice
              tone="error"
              action={
                <Button size="sm" variant="secondary" onClick={locate} iconLeft={<MapPinOff className="size-4" aria-hidden="true" />}>
                  Try again
                </Button>
              }
            >
              {locationError} Your location is the pickup spot, so it's needed to post.
            </Notice>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={create.isPending}
            disabled={!coords}
            iconLeft={<Send className="size-4" aria-hidden="true" />}
            className="mt-1"
          >
            {create.isPending ? "Posting…" : "Post food"}
          </Button>
        </div>
      </form>
    </div>
  );
}
