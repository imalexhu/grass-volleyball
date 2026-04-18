import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { retrieveCheckoutSession } from "@/server/stripe";
import { registerTeamToTournament } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      session_id: search.session_id as string,
    };
  },
  component: CheckoutSuccess,
});

function CheckoutSuccess() {
  const { session_id } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const register = async () => {
      if (!session_id) {
        setStatus("error");
        return;
      }

      try {
        const session = await retrieveCheckoutSession({ data: { sessionId: session_id } });
        
        if (session.payment_status === "paid" && session.metadata) {
          const { tournamentId, teamName } = session.metadata;
          if (tournamentId && teamName) {
            await registerTeamToTournament(tournamentId, {
              id: crypto.randomUUID(),
              name: teamName,
              captain: "Registered User", // This should ideally come from auth or session
            });
            setStatus("success");
            toast.success("Registration confirmed!");
          } else {
            console.error("Missing metadata in session", session.metadata);
            setStatus("error");
          }
        } else {
          console.error("Payment not confirmed or missing metadata", session);
          setStatus("error");
        }
      } catch (error) {
        console.error("Failed to verify registration:", error);
        setStatus("error");
        toast.error("Failed to verify registration details.");
      }
    };

    register();
  }, [session_id]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center">
        <div className="mx-auto max-w-xl px-4 py-16 text-center glass rounded-2xl border border-primary/20 shadow-glow">
          {status === "loading" && (
            <div className="flex flex-col items-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <h1 className="text-2xl font-bold mb-2">Verifying Registration...</h1>
              <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
            </div>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.3)]">
                  <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">Registration Complete!</h1>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-sm leading-relaxed">
                  Your team's spot is secured successfully. We've updated the tournament standings. See you on the sand!
              </p>
              <Button asChild className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:shadow-glow hover:scale-105 transition-all duration-300">
                  <Link to="/home">View Tournaments</Link>
              </Button>
            </>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
                  <span className="text-2xl font-bold text-destructive">!</span>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-destructive">Registration Issue</h1>
              <p className="text-muted-foreground mb-8">We couldn't verify your registration. If payment was successful, please contact support.</p>
              <Button variant="outline" asChild>
                  <Link to="/home">Go Back Home</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
