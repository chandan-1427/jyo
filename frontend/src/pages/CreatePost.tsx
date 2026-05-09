import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { uploadImage } from "../lib/supabase";
import { getCurrentLocation, type Coords } from "../lib/location";

export default function CreatePost() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    description: "",
    pickupWindowStart: "",
    pickupWindowEnd: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Silently get location on mount
  useEffect(() => {
    getCurrentLocation()
      .then(setCoords)
      .catch(() => setError("Could not detect your location. Please enable location access."));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!coords) {
      setError("Location is required to create a post. Please enable location access.");
      return;
    }

    if (!photoFile) {
      setError("Please add a photo of the food.");
      return;
    }

    if (new Date(form.pickupWindowEnd) <= new Date(form.pickupWindowStart)) {
      setError("Pickup end time must be after start time.");
      return;
    }

    setLoading(true);

    try {
      const photoUrl = await uploadImage(photoFile, "food-photos");

      await apiFetch("/posts", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          photoUrl,
          pickupLat: coords.lat,
          pickupLng: coords.lng,
        }),
      });

      navigate("/my-posts");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-6">Post Food</h1>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg mb-4">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Photo */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Food Photo</label>
          {photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Food preview"
                className="w-full h-48 object-cover rounded-2xl"
              />
              <button
                type="button"
                onClick={() => { setPhotoFile(null); setPhotoPreview(""); }}
                className="absolute top-2 right-2 bg-white text-gray-500 rounded-full px-2 py-0.5 text-xs shadow hover:text-red-400 transition"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-gray-200 rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-orange-300 transition">
              <span className="text-3xl">📷</span>
              <span className="text-sm text-gray-400 mt-2">Tap to add food photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhoto}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Food Title</label>
          <input
            name="title"
            type="text"
            value={form.title}
            onChange={handleChange}
            placeholder="e.g. Rice and dal for 2"
            required
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">
            Description{" "}
            <span className="text-gray-300 font-normal">(optional)</span>
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Any details about the food, quantity, allergies..."
            rows={3}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition resize-none"
          />
        </div>

        {/* Pickup window */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Pickup Window</label>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-xs text-gray-400">From</span>
              <input
                name="pickupWindowStart"
                type="datetime-local"
                value={form.pickupWindowStart}
                onChange={handleChange}
                required
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 transition"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-xs text-gray-400">To</span>
              <input
                name="pickupWindowEnd"
                type="datetime-local"
                value={form.pickupWindowEnd}
                onChange={handleChange}
                required
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 transition"
              />
            </div>
          </div>
        </div>

        {/* Location indicator */}
        <div className={`text-xs px-3 py-2 rounded-lg ${coords ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
          {coords ? "📍 Location detected" : "⏳ Detecting your location..."}
        </div>

        <button
          type="submit"
          disabled={loading || !coords}
          className="bg-orange-500 text-white rounded-xl py-3 text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? "Posting..." : "Post Food"}
        </button>
      </form>
    </div>
  );
}