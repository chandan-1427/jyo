import { Link } from "react-router-dom";
import { textLinkClass } from "@/components/ui/TextLink";
import { Email, LegalPage, Section } from "@/components/legal/LegalPage";
import { FOOD_SAFETY_RULES } from "@/lib/legal";

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Use"
      summary={
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Jyo is free and only connects neighbours. We don't cook, check or deliver food.</li>
          <li>You must be 18 or older.</li>
          <li>Share only food that's safe to eat, never ask for or take money, and treat each other with respect.</li>
          <li>Food is shared and eaten at your own risk, so check it before you eat it.</li>
        </ul>
      }
    >
      <Section title="Agreeing to these terms">
        <p>
          Jyo (jyo.co.in) is run by Dakka Chandan, an individual based in YSR Kadapa, Andhra Pradesh. By creating an
          account or using Jyo, you agree to these Terms and to our{" "}
          <Link to="/privacy" className={textLinkClass}>Privacy Policy</Link>. If you don't agree, please don't use Jyo.
        </p>
      </Section>

      <Section title="Who can use Jyo">
        <ul>
          <li>You must be <strong>18 or older</strong>.</li>
          <li>One account per person, with your real name and a phone number and email address that are yours.</li>
          <li>You're responsible for what happens under your account, so keep your password to yourself.</li>
        </ul>
      </Section>

      <Section title="What Jyo is, and isn't">
        <p>
          Jyo is a free, non-commercial way for people in Tirupati to give away food they can't finish to someone
          nearby who can use it. We only pass messages between the two people. <strong>We don't prepare, inspect,
          store, transport or deliver any food</strong>, and we aren't a party to any arrangement between users. The
          person sharing decides who to give food to, and each person decides whether to eat it.
        </p>
      </Section>

      <Section id="food-safety" title="Food safety rules">
        <p>When you share food, you confirm it's safe to eat and that you follow these rules:</p>
        <ul>
          {FOOD_SAFETY_RULES.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
        <p>
          When you pick food up, check it before you eat it and eat it soon. If you have an allergy, or anything
          about the food seems wrong, don't eat it. If in doubt, leave it out.
        </p>
      </Section>

      <Section title="Rules for everyone">
        <ul>
          <li><strong>No money.</strong> Food on Jyo is always free. Don't sell, ask for payment or accept it.</li>
          <li><strong>Only food.</strong> No alcohol, tobacco, medicines or anything else.</li>
          <li><strong>Be honest</strong> about the food, yourself and when you'll arrive. If you can't make it, say so in the app.</li>
          <li><strong>Respect people and their privacy.</strong> Use a pickup spot or phone number you receive only for that pickup. Don't harass, threaten, contact people for other reasons, or share their details.</li>
          <li><strong>Don't misuse Jyo:</strong> no fake posts or requests, no automated access, and no attempts to break or get around its security.</li>
        </ul>
      </Section>

      <Section title="Your content">
        <p>
          You own the photos and text you post. You let us store them and show them to other users as Jyo works, for
          as long as they're on Jyo. Post only photos you took or may use, and don't include other people's faces
          without their permission.
        </p>
      </Section>

      <Section title="Ending things">
        <p>
          You can delete your account at any time from your Profile. We may remove content, or suspend or close an
          account, that breaks these Terms or puts others at risk, and we may change or stop Jyo, or any part of it,
          at any time.
        </p>
      </Section>

      <Section title="Responsibility">
        <p>
          Jyo is provided free and "as is", without guarantees that it will always be available or free of errors.
          Food is shared and eaten at the risk of the people involved. To the fullest extent the law allows, Jyo and
          the person running it aren't liable for any illness, injury, loss or dispute arising from food shared, a
          meeting between users, or the use of Jyo. Nothing in these Terms limits liability that can't be limited
          under Indian law.
        </p>
      </Section>

      <Section title="Law and disputes">
        <p>
          These Terms are governed by the laws of India. Any dispute will be handled by the courts at YSR Kadapa,
          Andhra Pradesh. Before that, please write to us at <Email />, and we'll try to sort it out together.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          If we change these Terms in a way that matters, we'll tell you in the app or by email before the change
          applies. If you keep using Jyo after that, you accept the new Terms. Questions? Write to <Email />.
        </p>
      </Section>
    </LegalPage>
  );
}
