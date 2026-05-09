import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { uploadImage } from "../lib/supabase";
import { getCurrentLocation } from "../lib/location";

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
      if (err instanceof Error) setError(err.message);
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
          <h2 className="font-bold text-gray-800 text-lg">Request Pickup</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg mb-4">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Your Name</label>
            <input
              type="text"
              value={pickerName}
              onChange={(e) => setPickerName(e.target.value)}
              required
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition"
            />
          </div>

          {/* ETA */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">
              ETA (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(e.target.value)}
              placeholder="e.g. 15"
              required
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition"
            />
          </div>

          {/* Selfie */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">
              Selfie Photo
            </label>
            <p className="text-xs text-gray-400">
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
                  className="absolute top-2 right-2 bg-white text-gray-500 rounded-full px-2 py-0.5 text-xs shadow hover:text-red-400 transition"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="mt-1 border-2 border-dashed border-gray-200 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-orange-300 transition">
                <span className="text-2xl">📷</span>
                <span className="text-xs text-gray-400 mt-1">
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-orange-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Submitting..." : "Request Pickup"}
          </button>
        </form>
      </div>
    </div>
  );
}