import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import pic1 from "@/assets/pic1.webp";
import { Package, PackageOpen } from "lucide-react";

import { LinkButton } from "@/components/ui/LinkButton";
import { Logo } from "@/components/ui/Logo";

const STEPS = [
  {
    step: "01",
    title: "Post food",
    desc: "Have extra food? Post it with a photo, a short description, and a pickup time window - how long you can wait for someone to collect it.",
  },
  {
    step: "02",
    title: "Nearby users request",
    desc: "Anyone within 20 km from bus stand can request to pick up the food. They share their name, selfie, and estimated arrival time for your review.",
  },
  {
    step: "03",
    title: "Approve and collect",
    desc: "You review the requests and approve one person. They come and collect the food from your location within the time window.",
  },
  {
    step: "04",
    title: "Stop sharing location",
    desc: "Once the food is collected or the time window completes, you can stop sharing the location. So your location is visible for a limited time, ensuring your privacy and safety.",
  },
];

const SAFETY_CARDS = [
  {
    title: "You decide who comes",
    body: "When someone requests your food, you see their name and selfie. If anything feels off, simply reject the request. No explanation needed.",
  },
  {
    title: "What if the wrong person shows up?",
    body: "If someone other than the approved person arrives, stop sharing your location immediately. They lose access. You stay safe.",
  },
  {
    title: "Selfies are not public",
    body: "The requester's photo is only visible to the poster. It is removed after pickup. No one else ever sees it.",
  },
  {
    title: "Your address stays private",
    body: "Your exact pickup location is never shown publicly. It is revealed only to the one person you approve.",
  },
];

const NOTES = {
  "Important to know": [
    "Currently available only within and around Tirupati. Example areas covered: Tirupati city, Tiruchanur, Renigunta, Alipiri, SV University, Karakambadi side, and Chandragiri.",
    "All pickups are self-collected - no delivery involved.",
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

const POSTER_BENEFITS = [
  "you will throw it away.",
  "you want to donate to others.",
  "you don't want to go and donate in person.",
];

const REQUESTER_BENEFITS = [
  "you want it for yourself.",
  "you are a volunteer or an individual who want to donate to others but don't have food.",
  "you are a helping home who have food problems.",
  "you want to feed your nearby animals.",
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-medium text-2xl lg:text-3xl tracking-tight mt-1 mb-8">
      {children}
    </h2>
  );
}

function EyebrowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-md text-subtle tracking-wide mb-1">
      {children}
    </p>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-6 py-2 ${className}`}>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((note) => (
        <li key={note} className="flex gap-3 items-start text-sm leading-relaxed">
          <div className="w-1 h-1 rounded-full bg-neutral-600 mt-2.5 shrink-0" />
          <p>{note}</p>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const [imgLoaded, setImgLoaded] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/feed" replace />;

  return (
  <div className="min-h-screen font-medium">

    {/* Navbar */}
    <header className="mt-[-40px] sticky top-0 z-50 bg-background py-2">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo className="text-2xl" />
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center justify-center text-sm font-semibold tracking-tight px-5 py-2.5 rounded-lg border border-border text-muted hover:text-foreground hover:border-neutral-600 active:scale-[0.97] transition-all duration-150 ease-out"
          >
            Log in
          </Link>
          <LinkButton as="link" to="/register" label="Join Community" />
        </div>
      </div>
    </header>

    <main className="max-w-5xl mx-auto">

      {/* Hero */}
      <section className="grid lg:grid-cols-2 gap-16 items-center py-16 lg:py-20 px-6">
        <div className="flex flex-col">
          <EyebrowLabel>Community food sharing · Tirupati</EyebrowLabel>

          <h1 className="font-medium text-4xl lg:text-[2.75rem] leading-[1.15] mb-6 tracking-tight">
            Good food shouldn't be thrown away while someone nearby needs it.
          </h1>

          <p className="text-[15px] leading-relaxed mb-4">
            How many times have you had extra food that went to waste? You probably wished there
            was a way to give it to others, but life gets busy and it rarely happens.
          </p>

          <p className="text-[15px] leading-relaxed mb-8">
            And if you're a student - how many times did you sleep on an empty stomach because money
            was short, or your PG just didn't provide a proper meal?
          </p>

          <p className="text-[15px] leading-relaxed text-foreground font-medium mb-10 pl-4 border-l-2 border-accent/40">
            We built Jyo to bridge these two worlds. No delivery, no payment. Just people sharing with people.
          </p>

          <div className="flex flex-wrap gap-3 items-center">
            <LinkButton as="link" to="/register" label="Get Started" />
            <Link
              to="/login"
              className="inline-flex items-center justify-center text-sm font-semibold tracking-tight px-5 py-2.5 rounded-lg border border-border text-muted hover:text-foreground hover:border-neutral-600 active:scale-[0.97] transition-all duration-150 ease-out"
            >
              Log in
            </Link>
          </div>
        </div>

        {/* Hero image */}
        <div className="relative w-full h-[420px] lg:h-[560px] rounded-xl overflow-hidden bg-surface">
          {!imgLoaded && (
            <div className="absolute inset-0 animate-pulse bg-surface" />
          )}
          <img
            src={pic1}
            alt="Food sharing in Tirupati"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            onLoad={() => setImgLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-15">
        <div className="mb-10">
          <EyebrowLabel>How it works</EyebrowLabel>
          <h2 className="font-medium text-2xl lg:text-3xl tracking-tight">
            Sharing is done in four simple steps
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-0 border border-border rounded-xl overflow-hidden">
          {STEPS.map(({ step, title, desc }, i) => (
            <div
              key={step}
              className={`p-6 ${i < STEPS.length - 1 ? "border-r border-border" : ""}`}
            >
              <p className="text-xs font-bold text-accent/80 uppercase tracking-widest mb-3">{step}</p>
              <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who is Jyo for */}
      <section className="px-6 pt-1 pb-10">
        <EyebrowLabel>Who it's for</EyebrowLabel>
        <SectionHeading>Two worlds, one purpose - Reduce food waste</SectionHeading>

        <div className="grid md:grid-cols-2 gap-6">

          {/* Poster */}
          <div className="p-6 rounded-xl border border-border bg-surface/40">
            <div className="flex items-center gap-2 mb-5">
              <Package className="w-5 h-5 text-subtle" />
              <h3 className="text-sm font-semibold text-foreground">Poster</h3>
              <span className="text-sm font-normal">You have food but,</span>
            </div>
            <BulletList items={POSTER_BENEFITS} />
          </div>

          {/* Requester */}
          <div className="p-6 rounded-xl border border-border bg-surface/40">
            <div className="flex items-center gap-2 mb-5">
              <PackageOpen className="w-5 h-5 text-subtle" />
              <h3 className="text-sm font-semibold text-foreground">Requester</h3>
              <span className="text-sm font-normal">You need food because</span>
            </div>
            <BulletList items={REQUESTER_BENEFITS} />
          </div>

        </div>
      </section>

      {/* Info panels */}
      <section className="px-6 grid md:grid-cols-2 gap-4 pb-5">
        {Object.entries(NOTES).map(([heading, items]) => (
          <Card key={heading}>
            <h3 className="font-semibold text-sm text-foreground mb-5">
              {heading}
            </h3>
            <BulletList items={items} />
          </Card>
        ))}
      </section>

      {/* Safety & Privacy */}
      <section className="px-6 pt-5 pb-5">
        <SectionHeading>Why we ask for a selfie</SectionHeading>

        <p className="text-sm leading-relaxed text-subtle max-w-lg mb-10 -mt-4">
          Food is often shared from someone's home. If posters are women sharing from their residence,
          the selfie gives them real control over who shows up at their door.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SAFETY_CARDS.map(({ title, body }) => (
            <div key={title} className="p-5 bg-surface/40 rounded-xl border border-border">
              <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
              <p className="text-sm leading-relaxed text-subtle">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-15 text-center">
        <p className="text-sm font-medium mb-4">
          Free to join · No payments · Tirupati
        </p>
        <h2 className="font-medium text-2xl lg:text-3xl tracking-tight mb-8">
          Ready to share or find food?
        </h2>
        <LinkButton as="link" to="/register" label="Get Started" />
      </section>

    </main>

    {/* Footer */}
    <footer className="relative border-t border-border rounded-2xl px-6 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">

        {/* Top Section */}
        <div className="flex flex-col gap-14 md:flex-row md:justify-between md:gap-24">

          {/* Brand Block */}
          <div className="max-w-sm">
            <Logo className="text-5xl" />

            <p className="mt-4 text-sm leading-relaxed">
              Built to reduce food wastage through local community sharing.
            </p>

            <div className="mt-6 flex items-center gap-2 text-[13px] text-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Tirupati, Andhra Pradesh</span>
            </div>
          </div>

          {/* Link Columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:gap-16">

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-subtle">
                Connect
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                <li>
                  <a
                    href="https://mail.google.com/mail/?view=cm&to=jyofoodsharing@gmail.com&su=Jyo Support"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1 text-[13px] hover:text-foreground transition-colors"
                  >
                    Mail
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/chandan-1427/jyo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1 text-[13px] hover:text-foreground transition-colors"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com/jyo_food_sharing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1 text-[13px] hover:text-foreground transition-colors"
                  >
                    Instagram
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-subtle">
                Project
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                <li className="text-[13px]">MIT License</li>
                <li className="text-[13px]">Open source</li>
              </ul>
            </div>

          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 flex flex-col gap-4 border-t border-border pt-6 text-[13px] text-subtle md:flex-row md:items-center md:justify-between">
          <span>&copy; 2026 Jyo — built by Chandan Dakka</span>
          <span>Made for people, not for profit.</span>
        </div>
      </div>
    </footer>
  </div>
  );
}