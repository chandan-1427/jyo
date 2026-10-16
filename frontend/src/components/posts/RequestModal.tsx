import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api/api";
import { uploadImage } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/location/location";
import { requestSchema } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { AlertCircle, Camera, X } from "lucide-react";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { LinkButton } from "../ui/LinkButton";

type Props = {
  postId: string;
  onClose: () => void;
  onSuccess: () => void;
};

type RequestValues = { pickerName: string; etaMinutes: number; selfie: File };

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-400">{message}</p> : null;
}

export default function RequestModal({ postId, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, setError, formState: { errors } } = useZodForm(requestSchema, {
    pickerName: user?.name ?? "",
  });
  const [selfiePreview, setSelfiePreview] = useState("");

  const requestMutation = useMutation({
    mutationFn: async ({ pickerName, etaMinutes, selfie }: RequestValues) => {
      const coords = await getCurrentLocation();
      const selfieUrl = await uploadImage(selfie, "selfies");

      return apiFetch("/requests", {
        method: "POST",
        body: JSON.stringify({
          postId,
          pickerName,
          selfieUrl,
          etaMinutes,
          lat: coords.lat,
          lng: coords.lng,
        }),
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

  const handleSelfie = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValue("selfie", file, { shouldValidate: true });
    setSelfiePreview(URL.createObjectURL(file));
  };

  const clearSelfie = () => {
    setValue("selfie", undefined as unknown as File, { shouldValidate: true });
    setSelfiePreview("");
  };

  const onSubmit = handleSubmit((values) => requestMutation.mutate(values));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-lg">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-foreground text-lg tracking-tight">Request Pickup</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-subtle hover:text-foreground transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
            <p className="text-sm text-red-400 leading-snug">{error}</p>
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">

          {/* Name */}
          <Field label="Your Name">
            <Input
              type="text"
              placeholder="Your full name"
              aria-invalid={errors.pickerName ? true : undefined}
              {...register("pickerName")}
            />
            <FieldError message={errors.pickerName?.message} />
          </Field>

          {/* ETA */}
          <Field label="Estimated Time to Arrive (minutes)">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={180}
              placeholder="e.g. 15"
              aria-invalid={errors.etaMinutes ? true : undefined}
              {...register("etaMinutes", { valueAsNumber: true })}
            />
            <FieldError message={errors.etaMinutes?.message} />
          </Field>

          {/* Selfie */}
          <Field label="Selfie Photo">
            <p className="text-xs text-subtle -mt-1">
              So the poster can identify you at pickup
            </p>

            {selfiePreview ? (
              <div className="relative mt-1">
                <img
                  src={selfiePreview}
                  alt="Selfie preview"
                  className="w-full h-40 object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={clearSelfie}
                  className="cursor-pointer absolute top-2 right-2 bg-surface border border-border text-muted rounded-full px-2 py-0.5 text-xs shadow-sm hover:text-red-400 hover:border-red-900/40 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="mt-1 border border-dashed border-border rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-border-strong hover:bg-background transition-colors group">
                <Camera className="w-5 h-5 text-subtle group-hover:text-muted transition-colors mb-1.5" />
                <span className="text-xs text-subtle group-hover:text-muted transition-colors">
                  Tap to upload selfie
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleSelfie}
                  className="hidden"
                />
              </label>
            )}
            <FieldError message={errors.selfie?.message} />
          </Field>

          <LinkButton
            as="button"
            type="submit"
            label="Request Pickup"
            loading={loading}
            loadingLabel="Submitting…"
            disabled={loading}
            className="mt-2 w-full"
          />

        </form>
      </div>
    </div>
  );
}
