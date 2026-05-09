import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/feed" replace />;

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center px-6 text-center">

      {/* Logo / Brand */}
      <div className="mb-6">
        <h1 className="text-5xl font-bold text-orange-500">Jyos</h1>
        <p className="text-sm text-gray-400 mt-1 tracking-widest uppercase">
          Jyo With Us
        </p>
      </div>

      {/* Tagline */}
      <p className="text-2xl font-semibold text-gray-800 max-w-md leading-snug">
        Good food shouldn't go to waste.
      </p>

      {/* Description */}
      <p className="text-gray-500 mt-4 max-w-sm text-base leading-relaxed">
        Jyos connects households with leftover food to students and neighbours
        in Tirupati who need it. Free. No delivery. Pure community sharing.
      </p>

      {/* How it works — 3 steps */}
      <div className="mt-10 flex flex-col sm:flex-row gap-4 text-left max-w-lg w-full">
        <div className="flex-1 bg-white rounded-2xl p-5 shadow-sm">
          <div className="text-2xl mb-2">🍱</div>
          <p className="font-semibold text-gray-700">Post your food</p>
          <p className="text-sm text-gray-400 mt-1">
            Got leftovers? Post them with a photo and pickup window.
          </p>
        </div>
        <div className="flex-1 bg-white rounded-2xl p-5 shadow-sm">
          <div className="text-2xl mb-2">📍</div>
          <p className="font-semibold text-gray-700">Browse nearby</p>
          <p className="text-sm text-gray-400 mt-1">
            See food posts within 10 km of you in real time.
          </p>
        </div>
        <div className="flex-1 bg-white rounded-2xl p-5 shadow-sm">
          <div className="text-2xl mb-2">🤝</div>
          <p className="font-semibold text-gray-700">Pick it up</p>
          <p className="text-sm text-gray-400 mt-1">
            Request, get approved, and collect it yourself. Free.
          </p>
        </div>
      </div>

      {/* CTAs */}
      <div className="mt-10 flex gap-4">
        <a
          href="/register"
          className="bg-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-orange-600 transition"
        >
          Get Started
        </a>
        <a
          href="/login"
          className="border border-orange-400 text-orange-500 px-8 py-3 rounded-xl font-semibold hover:bg-orange-50 transition"
        >
          Login
        </a>
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-300 mt-12">
        Currently available in Tirupati only.
      </p>
    </div>
  );
}