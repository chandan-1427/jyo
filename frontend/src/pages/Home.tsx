import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useV2Theme } from "@/lib/theme";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { PickupPreview } from "@/components/home/PickupPreview";
import { CoverageMap } from "@/components/home/CoverageMap";

// Each card's body leads with one bright phrase and continues dimmed, so a
// reader skimming only the bright text still gets the whole story.
const STEPS = [
  { time: "6:40 pm", title: "Anjali posts food", body: "She adds a photo, a short note, and the pickup time: 7 to 9 pm." },
  { time: "6:52 pm", title: "Rahul asks for it", body: "Anjali sees his name, his selfie, and when he will come." },
  { time: "6:55 pm", title: "Anjali says yes", body: "Now only Rahul can see her location. Nobody else on Jyo can." },
  { time: "7:12 pm", title: "Rahul picks it up", body: "Anjali marks it as collected. Her location is hidden again." },
];

const SAFEGUARDS = [
  {
    title: "You choose who comes",
    lead: "Every request shows a name, a selfie, and when they will come.",
    rest: "You can say no to anyone. You don't need to give a reason.",
  },
  {
    title: "Your location is hidden",
    lead: "Only the person you say yes to can see your location.",
    rest: "Nobody else on Jyo can see where you live.",
  },
  {
    title: "Hidden again after pickup",
    lead: "Mark the food as collected, and your location is hidden again.",
    rest: "The person who picked it up cannot see it anymore.",
  },
  {
    title: "Wrong person at your door?",
    lead: "Don't give the food. Tap “stop sharing location”.",
    rest: "They cannot see your location anymore.",
  },
];

const AREAS = ["Tirupati city", "Alipiri", "SV University", "Tiruchanur", "Karakambadi", "Renigunta", "Chandragiri"];

const AUDIENCES = [
  {
    title: "People who share food",
    items: [
      "Cooked too much for a function or pooja",
      "Don't want to throw food away",
      "Want to help, but can't go out to give it",
    ],
  },
  {
    title: "People who pick up food",
    items: [
      "Students, and anyone who wants home food",
      "Volunteers and care homes who feed people",
      "People who feed street animals",
    ],
  },
];

const FOOTER_LINKS = [
  { label: "Email", href: "https://mail.google.com/mail/?view=cm&to=jyofoodsharing@gmail.com&su=Jyo Support" },
  { label: "Instagram", href: "https://www.instagram.com/jyo_food_sharing" },
  { label: "GitHub", href: "https://github.com/chandan-1427/jyo" },
];

const INTRO_KEY = "jyo:home-intro";

// The hero's entrance is a first-impression flourish, so it plays once per
// session. Coming back to this page shows it instantly.
function useFirstVisit() {
  const [first] = useState(() => {
    try {
      return sessionStorage.getItem(INTRO_KEY) === null;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      // Storage blocked (private mode): the intro just won't be suppressed.
    }
  }, []);
  return first;
}

const CARD = "rounded-2xl bg-raised p-6 ring-1 ring-inset ring-fg/[0.06] sm:p-7";

// Full-width hairline on top, content in the shared column below it.
function Section({ children }: { children: ReactNode }) {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">{children}</div>
    </section>
  );
}

// Two-tone heading: a dim line that names the topic, then a bright line that
// says the point. An optional short intro follows.
function SectionHeading({ dim, bright, children }: { dim: string; bright: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-3xl font-semibold leading-[1.15] sm:text-[2.5rem]">
        <span className="block text-fg-subtle">{dim}</span>
        <span className="block">{bright}</span>
      </h2>
      {children && <p className="mt-5 text-lg leading-relaxed text-fg-muted">{children}</p>}
    </div>
  );
}

function Lead({ lead, rest }: { lead: string; rest: string }) {
  return (
    <p className="leading-relaxed text-fg-muted">
      <span className="font-medium text-fg">{lead}</span> {rest}
    </p>
  );
}

function CallsToAction({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:flex sm:flex-row", className)}>
      <Button to="/register" size="lg">
        <span className="sm:hidden">Share food</span>
        <span className="hidden sm:inline">I have food to share</span>
      </Button>
      <Button to="/register" size="lg" variant="secondary">
        <span className="sm:hidden">Find food</span>
        <span className="hidden sm:inline">I'm looking for food</span>
      </Button>
    </div>
  );
}

export default function Home() {
  useV2Theme();
  const { user, loading } = useAuth();
  const firstVisit = useFirstVisit();

  if (loading) return null;
  if (user) return <Navigate to="/feed" replace />;

  const enter = (step: number): { className?: string; style?: CSSProperties } =>
    firstVisit
      ? { className: "motion-safe:animate-enter", style: { animationDelay: `${step * 90}ms` } }
      : {};

  return (
    <div className="min-h-screen bg-canvas text-fg">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-14 px-4 pt-10 pb-24 sm:px-6 sm:pt-16 lg:grid-cols-12 lg:gap-10 lg:pb-32">
          <div className="lg:col-span-7 lg:pt-6">
            <h1
              lang="te"
              className={cn(
                "font-display text-[2.5rem] font-semibold leading-[1.2] sm:text-[3.5rem] lg:text-[3.75rem]",
                enter(0).className
              )}
              style={enter(0).style}
            >
              ఎక్కువ food ఉందా?{" "}
              <span className="text-fg-muted">దగ్గరలో ఉన్నవారితో పంచుకోండి.</span>
            </h1>

            <p
              className={cn("mt-6 font-display text-xl font-medium sm:text-2xl", enter(1).className)}
              style={enter(1).style}
            >
              Have extra food? Give it to someone near you.
            </p>
            <p
              className={cn("mt-3 max-w-[34rem] leading-relaxed text-fg-muted sm:text-lg", enter(2).className)}
              style={enter(2).style}
            >
              Post your food and the time someone can pick it up. People within 20&nbsp;km of Tirupati
              bus stand can ask for it. You see who is asking, and you decide who comes.
            </p>

            <div className={cn("mt-9", enter(3).className)} style={enter(3).style}>
              <CallsToAction />
              <p className="mt-5 text-base font-medium text-fg sm:text-lg">
                <span className="text-leaf">Free.</span> No payment. No delivery.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="mx-auto max-w-md lg:mt-4">
              <PickupPreview animate={firstVisit} />
            </div>
          </div>
        </section>

        <Section>
          <SectionHeading dim="How it works." bright="From post to pickup in one evening.">
            No delivery and no money. Someone near you comes to your home to pick up the food, at a
            time you choose.
          </SectionHeading>
          {/* Each card is a subgrid spanning the list's two rows (title with
              time, then text), so descriptions start on the same line across
              cards side by side, even when one title wraps. */}
          <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ time, title, body }) => (
              <li key={time} className={cn(CARD, "row-span-2 grid grid-rows-subgrid gap-y-0")}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold leading-snug">{title}</h3>
                  <span className="shrink-0 text-[13px] font-medium text-fg-subtle tabular-nums">{time}</span>
                </div>
                <p className="mt-2 leading-relaxed text-fg-muted">{body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section>
          <SectionHeading dim="You share from your home," bright="so you stay in control.">
            Many people who share food are women cooking at home. That is why we ask for a selfie. You
            see who is coming before you say yes.
          </SectionHeading>
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {SAFEGUARDS.map(({ title, lead, rest }) => (
              <div key={title} className={CARD}>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <div className="mt-3">
                  <Lead lead={lead} rest={rest} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section>
          <SectionHeading dim="Only in Tirupati." bright="Within 20 km of the bus stand.">
            So the person who asks for your food is always close by.
          </SectionHeading>
          <div className="mt-14 grid gap-4 lg:grid-cols-12">
            <div className={cn(CARD, "lg:col-span-5")}>
              <h3 className="font-display text-lg font-semibold">Places we cover</h3>
              <ul className="mt-5 flex flex-wrap gap-2">
                {AREAS.map((area) => (
                  <li key={area} className="rounded-full bg-lifted px-3.5 py-1.5 text-sm font-medium text-fg-muted">
                    {area}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-fg-muted">And every place in between.</p>
            </div>
            <div className={cn(CARD, "flex justify-center lg:col-span-7")}>
              <CoverageMap />
            </div>
          </div>
        </Section>

        <Section>
          <SectionHeading dim="Who uses Jyo." bright="People who share, and people who pick up." />
          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {AUDIENCES.map(({ title, items }) => (
              <div key={title} className={CARD}>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <ul className="mt-5 flex flex-col gap-3">
                  {items.map((item) => (
                    <li key={item} className="leading-relaxed text-fg-muted">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section>
          <div className="text-center">
            <p lang="te" className="font-display text-3xl font-semibold leading-[1.3] sm:text-5xl">
              మీ దగ్గరలో ఎవరో ఆకలితో ఉన్నారు.
            </p>
            <p className="mt-3 font-display text-xl font-medium text-fg-subtle sm:text-2xl">
              Someone near you is hungry.
            </p>
            <CallsToAction className="mt-10 sm:justify-center" />
          </div>
        </Section>
      </main>

      {/* Same full-width hairline as the sections above. */}
      <footer className="border-t border-fg/[0.06] text-sm">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <Logo className="font-display text-2xl text-fg [&>span]:text-leaf" />
              <p className="mt-2 text-fg-muted">Free food sharing in Tirupati.</p>
            </div>
            {/* h-8 matches the logo's line height, so on desktop the links sit
                on the logo's centre line rather than its top edge. */}
            <ul className="-mx-2 flex flex-wrap md:h-8 md:items-center">
              {FOOTER_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-md px-2 py-2 font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-leaf"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 flex items-center justify-between gap-4 text-fg-subtle">
            <p>&copy; 2026 Jyo</p>
            <p>
              Built by{" "}
              <a
                href="https://portfolio-1-two-lovat.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm font-medium text-fg-muted underline decoration-fg/20 underline-offset-4 transition-colors hover:text-fg hover:decoration-fg/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
              >
                Chandan Dakka
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
