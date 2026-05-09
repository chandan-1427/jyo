import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type ProfileData = {
  id: string;
  name: string;
  email: string;
  phone: string;
  locationText: string | null;
  description: string | null;
  createdAt: string;
};

export default function Profile() {

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    locationText: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch("/users/me")
      .then((data) => {
        setProfile(data.user);
        setForm({
          name: data.user.name ?? "",
          phone: data.user.phone ?? "",
          locationText: data.user.locationText ?? "",
          description: data.user.description ?? "",
        });
      })
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      const data = await apiFetch("/users/me", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setProfile(data.user);
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-6">My Profile</h1>

      {/* Read-only info */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
          <p className="text-sm text-gray-700">{profile?.email}</p>
        </div>
        <div className="flex flex-col gap-1 mt-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Member since</p>
          <p className="text-sm text-gray-700">
            {profile ? new Date(profile.createdAt).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>

      {/* Editable form */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg mb-4">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg mb-4">
          Profile updated successfully.
        </p>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-4">

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Name</label>
          <input
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            required
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Phone</label>
          <input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            required
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">
            Area / Locality{" "}
            <span className="text-gray-300 font-normal">(optional)</span>
          </label>
          <input
            name="locationText"
            type="text"
            value={form.locationText}
            onChange={handleChange}
            placeholder="e.g. Balaji Nagar, Tirupati"
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">
            About you{" "}
            <span className="text-gray-300 font-normal">(optional)</span>
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="A short note about yourself — students, families, anyone is welcome"
            rows={3}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-orange-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}