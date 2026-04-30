import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Scale, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/tos")({
  component: TermsOfService,
  head: () => ({
    meta: [
      { title: "Terms of Service — Adelaide Grass Volleyball" },
      {
        name: "description",
        content:
          "Read the terms and conditions governing the use of Adelaide Grass Volleyball's platform and services.",
      },
    ],
  }),
});

function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-20 sm:pb-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Terms of Service
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Last updated: 29 April 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="space-y-12">
          <TosSection number="1" title="Agreement to Terms">
            <p>
              By accessing or using the Adelaide Grass Volleyball platform (the
              "Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you do not agree, you must not access or use the
              Service.
            </p>
            <p>
              These Terms constitute a legally binding agreement between you and
              Adelaide Grass Volleyball ("AGV", "we", "us", or "our").
            </p>
          </TosSection>

          <TosSection number="2" title="Eligibility">
            <p>
              You must be at least 13 years of age to use the Service. If you
              are under 18, you must have the consent of a parent or legal
              guardian. By using the Service, you represent and warrant that you
              meet these requirements.
            </p>
          </TosSection>

          <TosSection number="3" title="User Accounts">
            <p>
              To access certain features, you must create an account. You are
              responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
              <li>Providing accurate and current registration information</li>
              <li>
                Maintaining the confidentiality of your account credentials
              </li>
              <li>All activities that occur under your account</li>
              <li>
                Notifying us immediately of any unauthorised use of your account
              </li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate
              these Terms or that remain inactive for an extended period.
            </p>
          </TosSection>

          <TosSection number="4" title="Tournament Registration & Rules">
            <h4 className="text-sm font-bold text-foreground mt-4 mb-2">
              4.1 Registration
            </h4>
            <p>
              When you register a team for a tournament, you agree to the
              specific rules, schedule, and format of that event. Registrations
              are subject to availability and may close when the maximum number
              of teams is reached.
            </p>

            <h4 className="text-sm font-bold text-foreground mt-4 mb-2">
              4.2 Conduct During Matches
            </h4>
            <p>
              All participants are expected to uphold the spirit of fair play
              and sportsmanship. We reserve the right to disqualify any team or
              individual engaging in unsportsmanlike conduct, including but not
              limited to verbal abuse, physical aggression, or intentional rule
              violations.
            </p>

            <h4 className="text-sm font-bold text-foreground mt-4 mb-2">
              4.3 Match Results
            </h4>
            <p>
              Match scores recorded through the Service are considered final
              once a match is marked as complete. Disputes must be raised with
              the tournament organiser before the match is finalised.
            </p>
          </TosSection>

          <TosSection number="5" title="Payments & Refunds">
            <p>
              Tournament entry fees are processed through Stripe. By making a
              payment, you agree to Stripe's{" "}
              <a
                href="https://stripe.com/legal"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-glow underline underline-offset-2 transition-colors"
              >
                Terms of Service
              </a>
              .
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-card/40 p-5 space-y-2">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-success mt-1.5 shrink-0" />
                <p>
                  <span className="font-bold text-foreground">Full refund</span>{" "}
                  — if you withdraw more than 7 days before the tournament start
                  date.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-warning mt-1.5 shrink-0" />
                <p>
                  <span className="font-bold text-foreground">
                    50% refund
                  </span>{" "}
                  — if you withdraw between 3–7 days before the tournament.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-destructive mt-1.5 shrink-0" />
                <p>
                  <span className="font-bold text-foreground">No refund</span>{" "}
                  — withdrawals less than 3 days before the tournament or
                  no-shows.
                </p>
              </div>
            </div>
            <p className="mt-4">
              Refunds are processed back to the original payment method and may
              take 5–10 business days to appear.
            </p>
          </TosSection>

          <TosSection number="6" title="User Conduct">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
              <li>Use the Service for any unlawful or fraudulent purpose</li>
              <li>
                Attempt to gain unauthorised access to other accounts or
                systems
              </li>
              <li>
                Interfere with or disrupt the integrity or performance of the
                Service
              </li>
              <li>
                Upload or transmit malicious software, spam, or harmful content
              </li>
              <li>Impersonate any person or entity</li>
              <li>
                Scrape, harvest, or collect data from the Service without
                consent
              </li>
            </ul>
          </TosSection>

          <TosSection number="7" title="Video Content & VODs">
            <p>
              Match recordings may be uploaded to YouTube via the YouTube Data
              API. By participating in a tournament, you acknowledge and consent
              to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
              <li>
                Being recorded during matches by cameras set up by the
                organiser
              </li>
              <li>
                The recording being uploaded to YouTube and linked from the
                Service
              </li>
              <li>
                Automated highlight reels being generated from your match data
              </li>
            </ul>
            <p className="mt-3">
              You may request removal of specific video content by contacting
              us. Video content is also subject to{" "}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-glow underline underline-offset-2 transition-colors"
              >
                YouTube's Terms of Service
              </a>
              .
            </p>
          </TosSection>

          <TosSection number="8" title="Intellectual Property">
            <p>
              All content, branding, design, and software comprising the Service
              are owned by Adelaide Grass Volleyball and protected by
              intellectual property laws. You may not reproduce, distribute, or
              create derivative works without our written permission.
            </p>
            <p>
              User-generated content (team names, profile information) remains
              owned by you, but you grant us a non-exclusive, royalty-free
              licence to display it within the Service.
            </p>
          </TosSection>

          <TosSection number="9" title="Disclaimers">
            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Service is provided on an <strong>"AS IS"</strong> and{" "}
                <strong>"AS AVAILABLE"</strong> basis. We make no warranties,
                express or implied, regarding the Service's reliability,
                availability, or fitness for a particular purpose. We are not
                liable for any injuries sustained during tournaments or events
                organised through the platform.
              </p>
            </div>
          </TosSection>

          <TosSection number="10" title="Limitation of Liability">
            <p>
              To the maximum extent permitted by Australian law, AGV shall not
              be liable for any indirect, incidental, special, consequential, or
              punitive damages arising out of or relating to your use of the
              Service. Our total aggregate liability shall not exceed the amount
              you have paid to us in the 12 months preceding the claim.
            </p>
          </TosSection>

          <TosSection number="11" title="Indemnification">
            <p>
              You agree to indemnify and hold harmless Adelaide Grass Volleyball,
              its organisers, volunteers, and affiliates from any claims,
              damages, losses, or expenses arising from your use of the Service
              or violation of these Terms.
            </p>
          </TosSection>

          <TosSection number="12" title="Modifications to Terms">
            <p>
              We reserve the right to update these Terms at any time. Material
              changes will be communicated via the Service or email. Your
              continued use of the Service after changes take effect constitutes
              acceptance of the revised Terms.
            </p>
          </TosSection>

          <TosSection number="13" title="Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the
              laws of South Australia, Australia. Any disputes arising from
              these Terms shall be subject to the exclusive jurisdiction of the
              courts of South Australia.
            </p>
          </TosSection>

          <TosSection number="14" title="Termination">
            <p>
              We may terminate or suspend your access to the Service
              immediately, without prior notice, for any reason, including
              breach of these Terms. Upon termination, your right to use the
              Service ceases immediately. Provisions that by their nature should
              survive termination will remain in effect.
            </p>
          </TosSection>

          <TosSection number="15" title="Contact Us">
            <p>
              If you have any questions about these Terms of Service, please
              contact us at:
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-card/40 p-6">
              <p className="font-bold text-foreground">
                Adelaide Grass Volleyball
              </p>
              <p className="text-muted-foreground mt-1">Adelaide, South Australia</p>
              <p className="text-muted-foreground mt-1">
                Email:{" "}
                <a
                  href="mailto:legal@adelaidegrassvolleyball.com"
                  className="text-primary hover:text-primary-glow transition-colors"
                >
                  legal@adelaidegrassvolleyball.com
                </a>
              </p>
            </div>
          </TosSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/20 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 Adelaide Grass Volleyball. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm font-bold uppercase tracking-widest text-muted-foreground">
            <Link
              to="/policy"
              className="hover:text-primary transition-colors"
            >
              Privacy
            </Link>
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ─── */

function TosSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-xs font-black text-primary/50 tabular-nums tracking-tight">
          {number.padStart(2, "0")}
        </span>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      <div className="pl-8 space-y-3 text-sm text-muted-foreground leading-relaxed border-l border-border/40 group-hover:border-primary/20 transition-colors">
        {children}
      </div>
    </div>
  );
}
