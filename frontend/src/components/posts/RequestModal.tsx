import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api/api";
import { uploadImage } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/location/location";
import { requestSchema } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { Dialog } from "../ui/Dialog";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { PhotoField } from "../ui/PhotoField";

type Props = {
  postId: string;
  onClose: () => void;
  onSuccess: () => void;
};

type RequestValues = { pickerName: string; etaMinutes: number; selfie: File };

export default function RequestModal({ postId, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, setError, formState: { errors } } = useZodForm(requestSchema, {
    pickerName: user?.name ?? "",
  });
  const requestMutation = useMutation({
    mutationFn: async ({ pickerName, etaMinutes, selfie }: RequestValues) => {
      const coords = await getCurrentLocation();
      const selfieUrl = await uploadImage(selfie, "selfies");

      return apiFetch("/requests", {
        method: "POST",
        body: JSON.stringify({ postId, pickerName, selfieUrl, etaMinutes, lat: coords.lat, lng: coords.lng }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
      onSuccess();
    },
    onError: (err) => {
      applyServerFieldErrors(err, setError, ["pickerName", "etaMinutes"]);
    },
  });

  const loading = requestMutation.isPending;
  // Field-level server errors show under their fields; anything else here.
  const fieldLevel = Object.values(errors).some((e) => e?.type === "server");
  const error = !fieldLevel ? requestMutation.error?.message ?? "" : "";

  const onSubmit = handleSubmit((values) => requestMutation.mutate(values));

  return (
    <Dialog title="Request pickup" onClose={onClose}>
      <p className="-mt-2 mb-6 leading-relaxed text-fg-muted">
        The person sharing sees this before deciding. If they approve, you'll see the exact pickup spot.
      </p>

      {error && <Notice tone="error" className="mb-5">{error}</Notice>}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <TextField
          label="Your name"
          autoComplete="name"
          error={errors.pickerName?.message}
          {...register("pickerName")}
        />

        <TextField
          label="How soon could you reach a spot in Tirupati?"
          type="number"
          inputMode="numeric"
          min={1}
          max={180}
          placeholder="15"
          hint="In minutes, up to 180. A rough guess is fine: it's within 20 km of you, and you'll see the exact spot once you're approved."
          error={errors.etaMinutes?.message}
          {...register("etaMinutes", { valueAsNumber: true })}
        />

        {/* Opens the front camera on phones. */}
        <PhotoField
          label="A selfie"
          emptyText="Take a selfie"
          chosenText="Retake selfie"
          hint="So they can recognise you at pickup."
          icon={<Camera aria-hidden="true" />}
          capture="user"
          error={errors.selfie?.message}
          onSelect={(file) => setValue("selfie", file, { shouldValidate: true })}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={loading}
          iconLeft={<Send className="size-4" aria-hidden="true" />}
          className="mt-1"
        >
          {loading ? "Sending…" : "Send request"}
        </Button>
      </form>
    </Dialog>
  );
}
