"use client";

import Link from "next/link";

export default function PrivacyPolicyPage() {
  const ivoryWhite = "#FFFFFF";
  const devaraGold = "#D4AF37";
  const charcoalShadow = "#2A2A2A";
  const deepSeaBlue = "#1E3D59";
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: ivoryWhite, color: charcoalShadow }}
    >
      <div className="mx-auto max-w-5xl px-6 py-20 space-y-16">
        <header className="space-y-4 text-center md:text-left">
          <p
            className="text-xs font-semibold uppercase tracking-[0.35em]"
            style={{ color: deepSeaBlue }}
          >
            Privacy Policy
          </p>
          <h1
            className="text-4xl font-display font-bold"
            style={{ color: devaraGold }}
          >
            Protecting Every Story
          </h1>
          <p className="text-sm opacity-80">Last updated {lastUpdated}</p>
        </header>

        <div className="grid gap-12">
          <section className="space-y-4 leading-relaxed">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Who We Are
            </h2>
            <div className="space-y-4">
              <p>
                Devara Creative is a modern creative studio rooted in Bali,
                Indonesia. We capture visual stories and digital experiences
                with a promise of privacy that aligns with global standards. We
                follow the principles of the GDPR and Indonesia’s Personal Data
                Protection (PDP) Law, ensuring that every interaction is handled
                with respect and intention.
              </p>
              <div
                className="border-t pt-4"
                style={{ borderColor: deepSeaBlue }}
              >
                <p>
                  This policy explains what information we collect, why we
                  collect it, and the rights you have over your data when you
                  connect with us as a client, visitor, or collaborator.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4 leading-relaxed">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Your Data
            </h2>
            <p>
              We gather only what is needed to support seamless creative
              collaborations and process your orders. This includes:
            </p>
            <ul className="space-y-2 pl-5" style={{ listStyle: "disc" }}>
              <li>Contact details such as your name, email, phone, and company (if applicable).</li>
              <li>Order details, including selected services, quantity, and notes you provide during checkout.</li>
              <li>Payment information necessary for transaction processing, handled securely by our payment partner.</li>
              <li>Project information, creative briefs, and uploaded content you share with us for custom projects.</li>
              <li>Communications, including emails, form submissions, and meeting notes.</li>
              <li>Website analytics like page views, device information, and referral sources collected through cookies.</li>
            </ul>
          </section>

          <section className="space-y-4 leading-relaxed">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              How We Use It
            </h2>
            <p>
              Every piece of information you share has a clear purpose:
            </p>
            <ul className="space-y-2 pl-5" style={{ listStyle: "disc" }}>
              <li>Processing and fulfilling your orders for services.</li>
              <li>Answering inquiries, building proposals, and delivering project updates.</li>
              <li>Coordinating creative workflows with team members and trusted collaborators.</li>
              <li>Improving our services, website experience, and communications.</li>
              <li>Maintaining records required for legal, tax, or contractual obligations.</li>
            </ul>
            <p>
              We never sell personal data. Limited information may be shared
              with carefully selected partners, such as our payment gateway **Xendit** for secure transaction processing, hosting providers, or production collaborators, strictly for
              the purposes listed above and only when they uphold equivalent
              privacy commitments. Necessary order and payment details are shared with Xendit to facilitate your transactions.
            </p>
          </section>

          <section className="space-y-4 leading-relaxed">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Tools & Cookies
            </h2>
            <p>
              Our website uses cookies and third-party services to keep your
              experience smooth and insightful. These tools may include Google
              Analytics for anonymous usage insights, form integrations to
              receive inquiries, email platforms to send project updates, and our secure payment processor, **Xendit**, to handle transactions.
            </p>
            <p>
              Xendit processes your payment information according to their own privacy policies and security standards. We encourage you to review Xendit's policies for more details. You can adjust your browser settings to control cookie use. Doing
              so may limit certain features, but you will still be able to
              explore who we are and what we create.
            </p>
          </section>

          <section className="space-y-4 leading-relaxed">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              How We Protect It
            </h2>
            <p>
              Access to personal data is restricted to team members and
              collaborators who need it to deliver your project or process your order. We rely on
              secure systems, encryption where appropriate (especially for payment processing via Xendit), and regular reviews
              of our processes to keep data safeguarded. If a data incident ever
              occurs, we will notify affected individuals and relevant
              authorities in line with applicable laws.
            </p>
          </section>

          <section className="space-y-4 leading-relaxed">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Your Rights
            </h2>
            <p>
              You are always in control of your personal information. You can:
            </p>
            <ul className="space-y-2 pl-5" style={{ listStyle: "disc" }}>
              <li>Request a copy of the data we hold about you.</li>
              <li>Ask us to correct or update any incomplete details.</li>
              <li>Request deletion of your data, unless we must retain it to meet legal or transactional duties.</li>
              <li>Withdraw consent for communications or certain processing at any time (this does not affect past processing).</li>
            </ul>
            <p>
              To exercise these rights, email{" "}
              <a
                href="mailto:hello@devaracreative.com"
                className="underline"
                style={{ color: deepSeaBlue }}
              >
                hello@devaracreative.com
              </a>{" "}
              and we will respond within a reasonable timeframe.
            </p>
          </section>

          <section className="space-y-4 leading-relaxed">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Staying Current
            </h2>
            <p>
              We may update this policy to reflect new regulations, tools, or
              studio practices. The latest version will always be available on
              this page, with the effective date clearly noted above.
            </p>
          </section>

          <section className="space-y-4 leading-relaxed">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Contact Us
            </h2>
            <p>
              Questions about privacy, data requests, or collaboration
              agreements can be directed to{" "}
              <a
                href="mailto:hello@devaracreative.com"
                className="underline"
                style={{ color: deepSeaBlue }}
              >
                hello@devaracreative.com
              </a>
              . We are here to respond with clarity and care.
            </p>
          </section>
        </div>

        <footer
          className="flex flex-col gap-3 border-t pt-6 text-sm md:flex-row md:items-center md:justify-between"
          style={{ borderColor: deepSeaBlue }}
        >
          <span>
            &copy; {new Date().getFullYear()} Devara Creative. All rights
            reserved.
          </span>
          <Link
            href="/terms"
            className="font-medium underline hover:opacity-75"
            style={{ color: deepSeaBlue }}
          >
            View Terms &amp; Conditions
          </Link>
        </footer>

        <p className="text-center text-base font-medium">
          At Devara Creative, privacy isn’t just a policy — it’s a reflection of
          our respect for every story entrusted to us.
        </p>
      </div>
    </div>
  );
}