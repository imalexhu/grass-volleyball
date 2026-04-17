import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export const Route = createFileRoute("/checkout/cancel")({
  component: CheckoutCancel,
});

function CheckoutCancel() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center">
        <div className="mx-auto max-w-xl px-4 py-20 text-center glass rounded-2xl border border-destructive/20">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
              <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-4">Checkout Cancelled</h1>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm">
              Your registration was not completed and your spot has not been secured.
          </p>
          <Button asChild variant="outline" className="border-border bg-surface/50 backdrop-blur">
              <Link to="/home">Return to tournaments</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
