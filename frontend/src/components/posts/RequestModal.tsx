import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { uploadImage } from "@/lib/supabase";
import { getCurrentLocation } from "@/lib/location";
import { AlertCircle, Camera, X } from "lucide-react";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { LinkButton } from "../ui/LinkButton";

type Props = {
  postId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function RequestModal({ postId, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [pickerName, setPickerName] = useState(user?.name ?? "");
  const [etaMinutes, setEtaMinutes] = useState("");
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState("");
  const [formError, setFormError] = useState("");

  const requestMutation = useMutation({
    mutationFn: async () => {
      const coords = await getCurrentLocation();
      const selfieUrl = await uploadImage(selfieFile!, "selfies");

      return apiFetch("/requests", {
        method: "POST",
        body: JSON.stringify({
          postId,
          pickerName,
          selfieUrl,
          etaMinutes: Number(etaMinutes),
          lat: coords.lat,
          lng: coords.lng,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
      onSuccess();
    },
  });

  const loading = requestMutation.isPending;
  const error = formError || requestMutation.error?.message || "";

  const handleSelfie = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selfieFile) {
      setFormError("Please upload a selfie so the poster can identify you");
      return;
    }

    requestMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-lg">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-foreground text-lg tracking-tight">Request Pickup</h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-subtle hover:text-foreground transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
            <p className="text-sm text-red-400 leading-snug">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Name */}
          <Field label="Your Name">
            <Input
              type="text"
              value={pickerName}
              onChange={(e) => setPickerName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </Field>

          {/* ETA */}
          <Field label="Estimated Time to Arrive (minutes)">
            <Input
              type="number"
              min="5"
              max="60"
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(e.target.value)}
              placeholder="e.g. 15"
              required
            />
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
                  onClick={() => { setSelfieFile(null); setSelfiePreview(""); }}
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