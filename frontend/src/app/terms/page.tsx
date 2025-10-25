"use client";

import Link from "next/link";

export default function TermsPage() {
  const ivoryWhite = "#FFFFFF";
  const devaraGold = "#D4AF37";
  const deepSeaBlue = "#1E3D59";
  const neutralGray = "#3C3C3C";
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: ivoryWhite, color: neutralGray }}
    >
      <div className="mx-auto max-w-5xl px-6 py-20 space-y-16">
        <header className="space-y-4 text-center md:text-left">
          <p
            className="text-xs font-semibold uppercase tracking-[0.35em]"
            style={{ color: deepSeaBlue }}
          >
            Terms &amp; Conditions
          </p>
          <h1
            className="text-4xl font-display font-bold"
            style={{ color: devaraGold }}
          >
            Working Together With Clarity
          </h1>
          <p className="text-sm opacity-80">Last updated {lastUpdated}</p>
        </header>

        <div className="space-y-12">
          <section className="grid gap-6 md:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] md:items-start">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Scope
            </h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Devara Creative provides photography, videography, web
                development, and creative direction services. These terms cover
                how we collaborate with clients and how visitors interact with
                our digital platforms. By accessing our site, requesting a
                proposal, or commissioning a project, you agree to these
                principles.
              </p>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] md:items-start">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Fair Use
            </h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Our digital spaces are curated to inspire and inform. Visitors
                agree not to misuse the website, interfere with its security,
                or repurpose its content without written consent. We reserve the
                right to suspend access or refuse service where misuse or
                unlawful activity is suspected.
              </p>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] md:items-start">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Ownership
            </h2>
            <div className="space-y-4 leading-relaxed">
              <div className="space-y-2">
                <h3 className="text-base font-semibold" style={{ color: deepSeaBlue }}>
                  Studio Rights
                </h3>
                <p>
                  All visuals, text, concepts, code, and other materials on this
                  website belong to Devara Creative unless otherwise credited.
                  Temporary or preview assets shared during a project remain our
                  property until final approval and payment are complete.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold" style={{ color: deepSeaBlue }}>
                  Client Usage
                </h3>
                <p>
                  Upon settlement of the agreed fees, clients receive the usage
                  rights detailed in their proposal or contract. Unless we agree
                  otherwise in writing, Devara Creative may feature completed
                  work in portfolios, showcases, or award submissions while
                  respecting any confidential elements.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] md:items-start">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Payments
            </h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Project investments, deliverables, and schedules follow the
                terms in each proposal or contract. Payments for online orders are processed securely through our payment gateway partner, **Xendit**. By making a payment, you agree to Xendit's terms and privacy policy in addition to ours.
              </p>
              <p>
                A non-refundable deposit is commonly required for custom projects to reserve studio time. Adjustments to scope may influence timelines and fees, and we will confirm any impact before proceeding. Timely feedback and approvals help keep projects on schedule. Payment failures or delays may impact project timelines or delivery.
              </p>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] md:items-start">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Limitations
            </h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                We bring professional care to every engagement, yet certain
                factors remain outside our control. Devara Creative is not
                responsible for indirect losses, business interruptions,
                third-party service issues (including payment processing via Xendit), or website downtime. In all cases,
                our total liability will not exceed the fees paid to us for the
                relevant project phase or order.
              </p>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] md:items-start">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Dispute Resolution
            </h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                If a concern arises, we invite open dialogue so we can resolve
                matters quickly. Should a formal dispute persist, the parties
                agree to seek mediation in Bali, Indonesia before considering
                other legal avenues. These terms are governed by Indonesian law.
              </p>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] md:items-start">
            <h2
              className="text-2xl font-semibold"
              style={{ color: devaraGold }}
            >
              Contact
            </h2>
            <div className="space-y-3 leading-relaxed">
              <p>
                Questions about these terms or a specific project can be sent to{" "}
                <a
                  href="mailto:hello@devaracreative.com"
                  className="underline hover:opacity-75"
                  style={{ color: deepSeaBlue }}
                >
                  hello@devaracreative.com
                </a>
                . We will respond with clarity, respect, and the intent to keep
                our collaboration strong.
              </p>
            </div>
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
            href="/privacy"
            className="font-medium underline hover:opacity-75"
            style={{ color: deepSeaBlue }}
          >
            View Privacy Policy
          </Link>
        </footer>

        <p className="text-center text-base font-medium">
          By working with Devara Creative, you agree to collaborate in a process
          built on trust, creativity, and clarity — values that define our
          craft.
        </p>
      </div>
    </div>
  );
}