import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { uploadImage } from "../lib/supabase";
import { getCurrentLocation } from "../lib/location";
import { AlertCircle, Camera } from "lucide-react";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";
import { LinkButton } from "./ui/LinkButton";

type Props = {
  postId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function RequestModal({ postId, onClose, onSuccess }: Props) {
  const { user } = useAuth();

  const [pickerName, setPickerName] = useState(user?.name ?? "");
  const [etaMinutes, setEtaMinutes] = useState("");
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSelfie = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selfieFile) {
      setError("Please upload a selfie so the poster can identify you");
      return;
    }

    setLoading(true);

    try {
      // Get current location
      const coords = await getCurrentLocation();

      // Upload selfie to Supabase
      const selfieUrl = await uploadImage(selfieFile, "selfies");

      // Submit request
      await apiFetch("/requests", {
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

      onSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Backdrop
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-lg">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-neutral-900 text-lg tracking-tight">Request Pickup</h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-neutral-400 hover:text-neutral-700 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-px shrink-0" />
            <p className="text-sm text-red-600 leading-snug">{error}</p>
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
            <p className="text-xs text-neutral-400 -mt-1">
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
                  className="cursor-pointer absolute top-2 right-2 bg-white border border-neutral-200 text-neutral-500 rounded-full px-2 py-0.5 text-xs shadow-sm hover:text-red-500 hover:border-red-200 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="mt-1 border border-dashed border-neutral-200 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-neutral-300 hover:bg-neutral-50 transition-colors group">
                <Camera className="w-5 h-5 text-neutral-300 group-hover:text-neutral-400 transition-colors mb-1.5" />
                <span className="text-xs text-neutral-400 group-hover:text-neutral-500 transition-colors">
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