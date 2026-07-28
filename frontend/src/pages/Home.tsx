import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import screenshotFeed from "@/assets/screenshot-feed.png";
import screenshotApprove from "@/assets/screenshot-approve.png";
import { Package, PackageOpen, MapPin, Info, ShieldCheck, UserCheck, Wallet } from "lucide-react";

import { LinkButton } from "@/components/ui/LinkButton";
import { Logo } from "@/components/ui/Logo";

// The poster's three real objections — who learns where I live, who turns up at
// my door, what does this cost me. Deliberately phrased as reassurances rather
// than features, and kept to three: a fourth would dilute all of them.
// Tightened to fit one row at desktop — three reassurances breaking 2-then-1
// looked like the third was an afterthought, which is the opposite of the point.
const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Address hidden until you approve" },
  { icon: UserCheck,   text: "See their name and photo first" },
  { icon: Wallet,      text: "Free — no payments, no delivery" },
];

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

const AREAS = [
  "Tirupati city",
  "Tiruchanur",
  "Renigunta",
  "Alipiri",
  "SV University",
  "Karakambadi",
  "Chandragiri",
];

const NOTES = {
  "Important to know": [
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

const NOTES_ICONS: Record<string, typeof Info> = {
  "Important to know": Info,
  "Safety & Privacy": ShieldCheck,
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
          <div className="w-1 h-1 rounded-full bg-subtle mt-2.5 shrink-0" />
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
  <div className="min-h-screen">

    {/*
      Dropped `font-medium` from this wrapper. It forced weight 500 onto the
      ENTIRE page, which is the main reason the old design read as flat: if
      everything is semi-bold, weight can no longer signal importance. Weight
      is now assigned per element, so it means something again.
    */}

    {/* Navbar. The old negative 40px top margin was a hack countering nothing — Home
        renders outside Layout — so it's gone. A hairline bottom border plus a
        blur replaces it: the header needs to separate from content when the
        page scrolls under it, which a plain opaque bar could not do. */}
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
        <Logo className="text-xl" />
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Both buttons come from LinkButton now. The outlined one used to be
              hand-written inline here AND again in the hero, character for
              character — the duplication that `variant` removes. */}
          <LinkButton
            as="link"
            to="/login"
            label="Log in"
            variant="secondary"
            className="px-4 sm:px-5"
          />
          {/* Matches the hero's primary CTA wording. "Get Started" appeared
              four times on this page and told a visitor nothing about which
              of the two things they were starting. */}
          <LinkButton
            as="link"
            to="/register"
            label="Share food"
            className="px-4 sm:px-5"
          />
        </div>
      </div>
    </header>

    <main className="max-w-5xl mx-auto">

      {/*
        HERO — rebuilt around one job: get a first-time visitor, on a phone, to
        trust this enough to register.

        Layout went from a 2-column text/image split to a single centred column
        with the product shot full-width beneath it. Two reasons. The screenshot
        is 1303×520 (2.5:1) — cramming it into the old fixed 420/560px-tall box
        meant object-cover threw most of it away, and a cropped screenshot
        of a trust-critical product is worse than none. And a single column is
        the same structure at 375px as at 1280px, so the mobile experience —
        which is nearly all of this audience — is the designed one, not a
        leftover.
      */}
      <section className="px-5 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-20">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center">

          {/*
            H1. The old one was a 12-word ethical statement — true, but it asked
            the reader to agree with a principle before knowing what the product
            does. This asks a question the target poster can answer in their own
            kitchen, right now, and pairs it with the consequence.

            Weight 600 against body copy's 400, ~3× the body size, and full
            `foreground` against `muted`. Hierarchy needs size, weight AND
            colour moving together; the old page varied only size.

            `text-balance` keeps the two lines close in length instead of
            leaving one orphaned word — the detail that separates set type from
            default type.
          */}
          <h1 className="mt-6 max-w-[22ch] font-semibold text-[2rem] sm:text-5xl lg:text-[3.25rem] leading-[1.08] tracking-[-0.03em] text-foreground text-balance">
            ఎక్కువ food ఉందా?{" "}
            {/* The two sentences are separated by COLOUR, not by a hard <br>.
                A forced break fought `text-balance` and stranded "now." alone
                on a third line — an orphan is the most visible typographic
                error a hero can have. Letting it wrap freely, balanced, and
                capping the measure at 22ch keeps the lines even at every
                width instead of only at the one I happened to test. */}
            <span className="text-muted">దగ్గరలో ఉన్నవారితో పంచుకోండి.</span>
          </h1>

          {/*
            TELUGU SLOT — intentionally reserved, not filled.

            The audience is Tirupati households; English-only signals "app built
            for engineers". But machine-quality Telugu on a page whose entire
            job is trust would cost more than it gains, so the slot is built to
            spec — correct scale, weight, colour and spacing — and left for a
            native speaker.

            TODO(chandan): replace with the real Telugu line, then delete this
            comment. Suggested sense (do NOT translate literally — write what a
            Tirupati neighbour would actually say): "Extra food? Share it with
            someone close by." Keep it to ~6 words so it holds one line on a
            375px screen.
          */}
          <p className="mt-4 font-geist text-lg sm:text-xl text-subtle" lang="te">
            మీ దగ్గరలో ఎవరో ఆకలితో ఉన్నారు.
          </p>

          {/*
            Subhead. Replaces four paragraphs (~90 words, two rhetorical
            questions). A stranger does not read your essay — this states what
            it is, who it is for, the boundary, and the catch, in one breath.
            `max-w-xl` holds the line length near 65 characters; centred text
            much wider than that is genuinely hard to read.
          */}
          <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-muted">
            Jyo connects households with food to spare to students and neighbours
            within 20&nbsp;km of Tirupati bus stand. You choose who collects it.
          </p>

          {/*
            SPLIT-INTENT CTA — the biggest structural change on the page.

            Before: "Get Started" four times, identical, for a product with two
            audiences who want opposite things. A visitor had to work out which
            one they were. Now each side gets its own door, and the whole
            "Who it's for" section becomes redundant.

            "Share food" is primary because supply is the binding constraint in
            every sharing marketplace — requesters who arrive to an empty feed
            do not come back — and because the poster carries the higher-friction
            ask, so they need the stronger invitation.

            Both are `sm:w-auto` but full-width stacked on mobile: side-by-side
            buttons at 375px produce two cramped targets, and these are the only
            two things worth tapping.
          */}
          <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <LinkButton
              as="link"
              to="/register"
              label="I have food to share"
              className="w-full sm:w-auto py-3"
            />
            <LinkButton
              as="link"
              to="/register"
              label="I'm looking for food"
              variant="secondary"
              className="w-full sm:w-auto py-3"
            />
          </div>

          {/*
            TRUST ROW. These three facts existed on the old page but were buried
            2,000px down, split across a step, four bullets and four cards that
            all said the same thing three times over.

            They are the poster's three actual fears — who learns where I live,
            who is at my door, what will this cost me — and they belong ABOVE
            the fold, next to the button that asks them to take the risk.
            Answering the objection at the point of decision is what converts;
            repeating it later just reads as anxiety.
          */}
          <ul className="mt-10 flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-x-6 gap-y-3">
            {TRUST_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 text-sm text-subtle">
                <Icon className="w-4 h-4 shrink-0 text-accent" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/*
          PRODUCT SHOT. Now uncropped at its true 1303:520 ratio, full width.

          `aspect-[1303/520]` on the wrapper reserves the exact final height
          before the image decodes, so there is no layout shift — which matters
          most on the slow connections this audience is actually on.
        */}
        <div className="mt-14 sm:mt-20 max-w-5xl mx-auto">
          <div className="relative aspect-[1303/520] w-full overflow-hidden rounded-xl border border-border bg-surface">
            {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-surface" />}
            <img
              src={screenshotFeed}
              alt="The Jyo feed showing nearby food posts available for pickup, each with a photo, description, pickup window and status"
              loading="eager"
              decoding="sync"
              fetchPriority="high"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </div>
        </div>
      </section>

      {/* Coverage area */}
      <section className="px-6 pb-15">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-subtle" />
          <p className="text-sm text-subtle">
            Live within ~20 km of Tirupati bus stand, covering:
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {AREAS.map((area) => (
            <span
              key={area}
              className="px-3 py-1.5 rounded-full border border-border text-xs text-muted"
            >
              {area}
            </span>
          ))}
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

        <div className="mt-6 rounded-xl border border-border overflow-hidden bg-surface">
          <img
            src={screenshotApprove}
            alt="Poster reviewing a pickup request with the requester's name, selfie, and estimated arrival time before approving"
            loading="lazy"
            className="w-full h-auto"
          />
        </div>
      </section>

      {/* Who is Jyo for */}
      <section className="px-6 pt-1 pb-10">
        <EyebrowLabel>Who it's for</EyebrowLabel>
        <SectionHeading>Two worlds, one purpose - Reduce food waste</SectionHeading>

        <div className="grid md:grid-cols-2 gap-6">

          {/* Poster */}
          <div className="p-6 rounded-xl border border-border bg-surface">
            <div className="flex items-center gap-2 mb-5">
              <Package className="w-5 h-5 text-subtle" />
              <h3 className="text-sm font-semibold text-foreground">Poster</h3>
              <span className="text-sm font-normal">You have food but,</span>
            </div>
            <BulletList items={POSTER_BENEFITS} />
          </div>

          {/* Requester */}
          <div className="p-6 rounded-xl border border-border bg-surface">
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
        {Object.entries(NOTES).map(([heading, items]) => {
          const Icon = NOTES_ICONS[heading];
          return (
            <Card key={heading}>
              <div className="flex items-center gap-2 mb-5">
                <Icon className="w-4 h-4 text-subtle" />
                <h3 className="font-semibold text-sm text-foreground">
                  {heading}
                </h3>
              </div>
              <BulletList items={items} />
            </Card>
          );
        })}
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
            <div key={title} className="p-5 bg-surface rounded-xl border border-border">
              <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
              <p className="text-sm leading-relaxed text-subtle">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA. The heading already asks "share or find?", so the single
          "Get Started" button below it was answering neither. Mirrors the hero
          pair — a closing CTA should offer the same two doors, or the reader
          who scrolled this far has to go back up to choose. Section padding
          went from a 15 step to a 20 step: v4's dynamic scale does generate a
          15, so it was valid, just off
          the 4-step rhythm every other section uses (60px against 64px). Odd
          one-off gaps are what make a page feel assembled rather than set. */}
      <section className="px-5 sm:px-6 py-20 text-center">
        <p className="text-sm text-subtle mb-4">
          Free to join · No payments · Early days in Tirupati
        </p>
        <h2 className="font-semibold text-2xl lg:text-3xl tracking-tight mb-8">
          Ready to share or find food?
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-center gap-3">
          <LinkButton
            as="link"
            to="/register"
            label="I have food to share"
            className="w-full sm:w-auto py-3"
          />
          <LinkButton
            as="link"
            to="/register"
            label="I'm looking for food"
            variant="secondary"
            className="w-full sm:w-auto py-3"
          />
        </div>
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