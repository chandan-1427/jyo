import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import pic1 from "../assets/pic1.jpg";

// ── Data ──────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    step: "01",
    title: "Post food",
    desc: "Have extra food? Post it with a photo, a short description, and a pickup time window — how long you can wait for someone to collect it.",
  },
  {
    step: "02",
    title: "Nearby users request",
    desc: "Anyone within 10 km can request to pick up the food. They share their name, selfie, and estimated arrival time for your review.",
  },
  {
    step: "03",
    title: "Approve and collect",
    desc: "You review the requests and approve one person. They come and collect the food from your location within the time window.",
  },
];

const NOTES = {
  "Important to know": [
    "Currently available only within and around Tirupati.",
    "All pickups are self-collected — no delivery involved.",
    "No payments or money involved at any step.",
    "Exact pickup location is shared only after the poster approves a request.",
  ],
  "Safety & Privacy": [
    "Selfies are only visible to the poster and are removed after pickup.",
    "Posters see the requester's photo and approve only if they feel comfortable.",
    "Your personal information is never shared publicly.",
    "Pickup location details are revealed only to the approved person.",
  ],
};

// ── Sub-components ────────────────────────────────────────────────────────────

function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-geist font-semibold text-neutral-400 tracking-[0.2em] uppercase mb-4">
      {children}
    </p>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-neutral-300 rounded-xl p-8 ${className}`}>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((note) => (
        <li key={note} className="flex gap-3 items-start">
          <div className="w-1 h-1 rounded-full bg-neutral-300 mt-2.5 shrink-0" />
          <p className="text-sm leading-relaxed text-neutral-500">{note}</p>
        </li>
      ))}
    </ul>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, loading } = useAuth();
  const [imgLoaded, setImgLoaded] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/feed" replace />;

  return (
    <div className="min-h-screen bg-white font-work text-neutral-900">

      {/* Navbar */}
      <header className="mt-[-40px] sticky top-0 z-50 bg-white border-b border-neutral-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="font-geist font-semibold text-[1.1rem] text-neutral-900 tracking-tight"
          >
            Jyo<span className="text-[#2D6A4F]">.</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              to="/login"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors duration-200"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium bg-neutral-900 hover:bg-neutral-700 text-white px-5 py-2 rounded-lg transition-colors duration-150"
            >
              Join Community
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">

        {/* Hero */}
        <section className="grid lg:grid-cols-2 gap-16 items-center py-16 lg:py-24 px-6">
          <div className="flex flex-col">
            <EyebrowLabel>Community food sharing · Tirupati</EyebrowLabel>

            <h1 className="font-geist font-semibold text-4xl lg:text-[2.75rem] leading-[1.15] text-neutral-900 mb-6 tracking-tight">
              Good food shouldn't be thrown away while someone nearby needs a meal.
            </h1>

            <p className="text-base leading-relaxed text-neutral-500 mb-4">
              How many times have you had extra food that went to waste? You probably wished there
              was a way to give it to others, but life gets busy and it rarely happens.
            </p>

            <p className="text-base leading-relaxed text-neutral-500 mb-8">
              And if you're a student — how many times did you sleep on an empty stomach because money
              was short, or your PG just didn't provide a proper meal?
            </p>

            <p className="text-base leading-relaxed text-neutral-700 font-medium mb-10 pl-4 border-l-2 border-neutral-200">
              We built Jyo to bridge these two worlds. No delivery, no payment. Just people sharing with people.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="text-sm font-medium bg-neutral-900 hover:bg-neutral-700 text-white px-6 py-2.5 rounded-lg transition-colors duration-150"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="text-sm font-medium border border-neutral-200 hover:border-neutral-400 text-neutral-700 px-6 py-2.5 rounded-lg transition-colors duration-150"
              >
                Log in
              </Link>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative w-full h-[420px] lg:h-[560px] rounded-xl overflow-hidden bg-neutral-100">
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-neutral-100" />
            )}
            <img
              src={pic1}
              alt="Food sharing in Tirupati"
              loading="eager"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 pb-20">
          <div className="mb-10">
            <EyebrowLabel>How it works</EyebrowLabel>
            <h2 className="font-geist font-semibold text-2xl lg:text-3xl text-neutral-900 tracking-tight">
              Sharing is done in three simple steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {STEPS.map(({ step, title, desc }) => (
              <Card key={step}>
                <p className="text-[11px] font-semibold text-neutral-400 tracking-[0.15em] uppercase mb-4">
                  {step}
                </p>
                <h3 className="font-geist font-semibold text-base text-neutral-900 mb-2 tracking-tight">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-500">{desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Info panels */}
        <section className="px-6 grid md:grid-cols-2 gap-4 pb-20">
          {Object.entries(NOTES).map(([heading, items]) => (
            <Card key={heading}>
              <h3 className="font-geist font-semibold text-base text-neutral-900 mb-5 tracking-tight">
                {heading}
              </h3>
              <BulletList items={items} />
            </Card>
          ))}
        </section>

        {/* Footer */}
        <footer className="px-6 border-t border-neutral-300 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-neutral-400">
            Built to reduce food wastage through local community sharing.
          </p>
          <p className="text-sm font-medium text-neutral-900">
            Jyo <span className="text-neutral-300 mx-1">·</span> Tirupati
          </p>
        </footer>

      </main>
    </div>
  );
}