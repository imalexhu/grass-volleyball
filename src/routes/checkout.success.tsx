import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export const Route = createFileRoute("/checkout/success")({
  component: CheckoutSuccess,
});

function CheckoutSuccess() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center">
        <div className="mx-auto max-w-xl px-4 py-20 text-center glass rounded-2xl border border-primary/20">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/30 shadow-glow">
              <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-4">Registration Complete!</h1>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm">
              Your team's spot is secured. We'll send the captain an email with scheduling and format details closer to the event date.
          </p>
          <Button asChild className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-glow">
              <Link to="/home">Browse more tournaments</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
