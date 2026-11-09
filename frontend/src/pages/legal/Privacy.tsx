import { Link } from "react-router-dom";
import { textLinkClass } from "@/components/ui/TextLink";
import { Email, LegalPage, Section } from "@/components/legal/LegalPage";

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary={
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>We collect only what Jyo needs to let neighbours share food, and we never sell it or show you ads.</li>
          <li>
            Your exact pickup spot, your name and your phone number go only to the one person you approve, and only
            until the pickup is over. Your phone number is shared only if you choose to, one pickup at a time.
          </li>
          <li>Photos are cleaned of hidden location data before they're stored.</li>
          <li>You can delete your account at any time from your Profile. It's erased completely after 30 days.</li>
        </ul>
      }
    >
      <Section title="Who we are">
        <p>
          Jyo (jyo.co.in) is a free, non-commercial food-sharing service for Tirupati, Andhra Pradesh, run by
          Dakka Chandan as an individual, from YSR Kadapa, Andhra Pradesh. For anything about your data, write to{" "}
          <Email />. This is also our contact for grievances under India's Digital Personal Data Protection Act,
          2023 (the "DPDP Act").
        </p>
      </Section>

      <Section title="What we collect">
        <p><strong>When you sign up:</strong> your name, email address, phone number and a password. We store only a scrambled form of the password (a bcrypt hash), never the password itself. We also record when you agreed to these policies.</p>
        <p><strong>In your profile, if you add them:</strong> your area, a few words about yourself and a profile photo.</p>
        <p><strong>When you share food:</strong> the title, description, photo and pickup time, and your exact location at the moment you post, which becomes the pickup spot.</p>
        <p><strong>When you ask for food:</strong> the name you give, a selfie, how soon you can get there, and your location at that moment (to check you're within 20 km; it isn't stored).</p>
        <p><strong>When you browse the feed:</strong> your location, rounded to about 1 km, to find food near you. It isn't stored.</p>
        <p><strong>If you choose to:</strong> whether you share your phone number for a pickup, and, if you turn on notifications, an address your browser gives us for delivering them.</p>
        <p><strong>When you pick food up:</strong> that you confirmed it, and any thank-you note you write, which the person who shared the food sees.</p>
        <p><strong>If you report or block someone:</strong> the report (the reason, any note you add, and the post's title) or the block. A report goes to the Jyo team only; the person reported isn't told who reported them, and isn't told when they're blocked.</p>
        <p><strong>Automatically:</strong> your IP address, and records of the requests your device makes (with your account ID), used to keep Jyo secure and working; and the notifications we've shown you.</p>
      </Section>

      <Section title="Who sees what">
        <ul>
          <li><strong>People near you</strong> see the food's title, description, photo, pickup time and distance. Not your name, not where you are.</li>
          <li><strong>Anyone a post's link is shared with</strong> (for example in a WhatsApp group) sees a preview with the food's photo, title, whether it's veg, how many it serves and the pickup time. Never where it is or who shared it, and only while the food is still on offer.</li>
          <li><strong>The person you approve</strong> sees the exact pickup spot and your name, from approval until the food is collected or the pickup is called off. They see your phone number only if you chose to share it.</li>
          <li><strong>A person sharing food</strong> sees the name, selfie and arrival time you send with a request, so they can decide and recognise you. They see your phone number only if you chose to share it.</li>
          <li><strong>The Jyo team</strong> can see your account details (name, email, phone number, when you joined and how much you've shared or asked for) to deal with reports and keep Jyo safe. They can remove a post or suspend an account that breaks the Terms; a suspended account can't log in and its posts are hidden.</li>
          <li><strong>No one else</strong> sees your email, phone number, exact location or account details. Your account ID is never shown to other people, so your posts can't be linked together.</li>
        </ul>
        <p>Every uploaded photo is re-encoded before it's stored, which removes hidden metadata such as the GPS position a phone camera records.</p>
      </Section>

      <Section title="Why we use it">
        <p>We use your data only to run Jyo: to create and protect your account, show food near you, pass requests and answers between the two people involved, send you emails and notifications about them, prevent abuse, and fix problems. We process it with your consent, which you give when you sign up and when you choose optional things like sharing your phone number or turning on notifications.</p>
        <p>We don't sell your data, show ads, use advertising or analytics trackers, or use your data to train AI models.</p>
      </Section>

      <Section title="Services that handle your data for us">
        <p>Jyo runs on these providers, each of which processes data only to provide its service to us:</p>
        <ul>
          <li><strong>Supabase:</strong> database and photo storage, on servers in Singapore.</li>
          <li><strong>Render:</strong> runs Jyo's server, in Singapore.</li>
          <li><strong>Vercel:</strong> serves the website.</li>
          <li><strong>Cloudflare:</strong> domain and network routing.</li>
          <li><strong>Resend:</strong> sends our emails.</li>
          <li><strong>Sentry:</strong> reports technical errors so we can fix them. A report can include your account ID and IP address, never your password.</li>
          <li><strong>Google, Apple, Mozilla or Microsoft:</strong> if you turn on notifications, your browser's maker delivers them. They receive only the notification's text, which never includes a name, phone number or place.</li>
          <li><strong>GitHub:</strong> stores our nightly database backups, encrypted so that only we can read them.</li>
        </ul>
        <p>Some of these providers process data outside India. We use only providers that protect it, and we don't transfer data to any country the Government of India restricts.</p>
      </Section>

      <Section title="How long we keep it">
        <ul>
          <li><strong>Your account and posts:</strong> until you delete your account.</li>
          <li><strong>Deleted accounts:</strong> hidden at once, with all your photos and selfies deleted straight away; everything else is erased 30 days later.</li>
          <li><strong>Sign-ups never confirmed by email:</strong> deleted soon after the confirmation link expires (24 hours).</li>
          <li><strong>Notifications:</strong> 14 days.</li>
          <li><strong>Reports and blocks:</strong> until either account involved is erased, or until you unblock.</li>
          <li><strong>Photos that were uploaded but never used</strong> (for example from a form you didn't finish): about 2 days.</li>
          <li><strong>Server logs:</strong> kept by our hosting provider for a limited period.</li>
          <li><strong>Backups:</strong> encrypted nightly copies, each kept for 30 days. Deleted data can remain in a backup until that backup expires.</li>
        </ul>
      </Section>

      <Section title="Cookies and storage on your device">
        <p>Jyo uses one cookie, to keep you logged in. It can't be read by scripts on the page and lasts at most 7 days. Your browser also remembers a few small preferences, such as whether you dismissed a message. There are no tracking or advertising cookies.</p>
      </Section>

      <Section title="Your rights">
        <p>Under the DPDP Act you can:</p>
        <ul>
          <li><strong>See and correct</strong> your details: most are in your Profile, and you can email us for anything else.</li>
          <li><strong>Withdraw consent and erase your data</strong> by deleting your account from your Profile. Turning off phone sharing or notifications withdraws those choices on their own.</li>
          <li><strong>Nominate someone</strong> to exercise your rights if you die or become unable to: email us.</li>
          <li><strong>Raise a grievance</strong> by emailing <Email />. We aim to reply within 7 days and resolve it within 30. If you're not satisfied, you can complain to the Data Protection Board of India.</li>
        </ul>
      </Section>

      <Section title="Age">
        <p>Jyo is only for people aged 18 or older, and you confirm this when you sign up. We don't knowingly collect data from anyone younger. If we learn an account belongs to someone under 18, we'll delete it.</p>
      </Section>

      <Section title="Security">
        <p>Connections to Jyo are encrypted, passwords are stored only as hashes, links sent by email work once and expire, sessions can be ended on the server, logins are protected against guessing, and backups are encrypted. No system is perfectly secure, but if a breach affects your data, we'll tell you and the Data Protection Board as the law requires.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>If we change this policy in a way that matters, we'll tell you in the app or by email before it applies. The date at the top shows when it last changed. See also our{" "}
          <Link to="/terms" className={textLinkClass}>Terms of Use</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
