import { createFileRoute, Link } from "@tanstack/react-router";

import { Shield, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/policy")({
  component: PrivacyPolicy,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Adelaide Grass Volleyball" },
      {
        name: "description",
        content:
          "Learn how Adelaide Grass Volleyball collects, uses, and protects your personal information.",
      },
    ],
  }),
});

function PrivacyPolicy() {
  return (
    <div className="flex-1 w-full">

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
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Privacy Policy
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
          <PolicySection number="1" title="Introduction">
            <p>
              Adelaide Grass Volleyball ("AGV", "we", "us", or "our") operates
              the Adelaide Grass Volleyball platform (the "Service"). This
              Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use our Service.
            </p>
            <p>
              By accessing or using the Service, you agree to the collection and
              use of information in accordance with this policy. If you do not
              agree, please do not use the Service.
            </p>
          </PolicySection>

          <PolicySection number="2" title="Information We Collect">
            <h4 className="text-sm font-bold text-foreground mt-4 mb-2">
              2.1 Account Information
            </h4>
            <p>
              When you create an account, we collect your email address, display
              name, and account role (player or organisation). Authentication is
              handled through Firebase Authentication.
            </p>

            <h4 className="text-sm font-bold text-foreground mt-4 mb-2">
              2.2 Tournament & Match Data
            </h4>
            <p>
              We collect information you provide when registering for
              tournaments, including team names, captain details, match scores,
              event timestamps, and highlight markers. This data is stored in
              Google Firebase Firestore.
            </p>

            <h4 className="text-sm font-bold text-foreground mt-4 mb-2">
              2.3 Video Data
            </h4>
            <p>
              Match recordings may be uploaded to YouTube via the YouTube Data
              API. By using video features, you also agree to{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-glow underline underline-offset-2 transition-colors"
              >
                Google's Privacy Policy
              </a>
              . We store YouTube video IDs and URLs to link VODs back to
              matches.
            </p>

            <h4 className="text-sm font-bold text-foreground mt-4 mb-2">
              2.4 Automatically Collected Data
            </h4>
            <p>
              We may automatically collect device information, browser type, IP
              address, and usage patterns through standard web server logs and
              analytics tools to improve the Service.
            </p>
          </PolicySection>

          <PolicySection number="3" title="How We Use Your Information">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>To create and manage your account</li>
              <li>To facilitate tournament registration and match tracking</li>
              <li>To process payments for tournament entry fees via Stripe</li>
              <li>To generate and publish match VODs and highlight reels</li>
              <li>To display live scores and standings</li>
              <li>
                To communicate important updates about tournaments you're
                registered for
              </li>
              <li>To improve, maintain, and secure the Service</li>
            </ul>
          </PolicySection>

          <PolicySection number="4" title="Third-Party Services">
            <p>We use the following third-party services:</p>
            <div className="mt-4 grid gap-3">
              <ThirdPartyItem
                name="Firebase (Google)"
                purpose="Authentication, database, and file storage"
              />
              <ThirdPartyItem
                name="YouTube Data API (Google)"
                purpose="Video uploads and VOD hosting"
              />
              <ThirdPartyItem
                name="Stripe"
                purpose="Payment processing for tournament entry fees"
              />
              <ThirdPartyItem
                name="Vercel"
                purpose="Application hosting and deployment"
              />
            </div>
            <p className="mt-4">
              Each third-party service has its own privacy policy governing the
              use of your information. We encourage you to review those policies.
            </p>
          </PolicySection>

          <PolicySection number="5" title="Data Retention">
            <p>
              We retain your personal data for as long as your account is
              active or as needed to provide you the Service. Match data,
              scores, and tournament results are retained indefinitely as
              historical records. You may request deletion of your account and
              associated personal data at any time by contacting us.
            </p>
          </PolicySection>

          <PolicySection number="6" title="Data Security">
            <p>
              We implement industry-standard security measures to protect your
              personal information, including encrypted connections (HTTPS),
              Firebase security rules, and secure authentication flows.
              However, no method of electronic transmission or storage is 100%
              secure, and we cannot guarantee absolute security.
            </p>
          </PolicySection>

          <PolicySection number="7" title="Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your personal data</li>
              <li>Withdraw consent for data processing</li>
              <li>Lodge a complaint with a data protection authority</li>
            </ul>
            <p className="mt-4">
              For Australian residents, your rights are protected under the{" "}
              <em>Privacy Act 1988</em> and the Australian Privacy Principles
              (APPs).
            </p>
          </PolicySection>

          <PolicySection number="8" title="Children's Privacy">
            <p>
              The Service is not intended for children under the age of 13. We
              do not knowingly collect personal information from children under
              13. If you become aware that a child has provided us with
              personal data, please contact us so we can take appropriate
              action.
            </p>
          </PolicySection>

          <PolicySection number="9" title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by updating the "Last updated"
              date at the top of this page. Continued use of the Service after
              changes constitutes acceptance of the updated policy.
            </p>
          </PolicySection>

          <PolicySection number="10" title="Contact Us">
            <p>
              If you have any questions about this Privacy Policy, please
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
                  href="mailto:privacy@adelaidegrassvolleyball.com"
                  className="text-primary hover:text-primary-glow transition-colors"
                >
                  privacy@adelaidegrassvolleyball.com
                </a>
              </p>
            </div>
          </PolicySection>
        </div>
      </section>

    </div>
  );
}

/* ─── Sub-components ─── */

function PolicySection({
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

function ThirdPartyItem({
  name,
  purpose,
}: {
  name: string;
  purpose: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/30 px-4 py-3">
      <div className="h-2 w-2 rounded-full bg-primary/50 mt-1.5 shrink-0" />
      <div>
        <span className="text-sm font-bold text-foreground">{name}</span>
        <span className="text-sm text-muted-foreground"> — {purpose}</span>
      </div>
    </div>
  );
}
