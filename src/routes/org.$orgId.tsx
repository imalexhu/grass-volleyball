import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getUserProfile, getTournaments } from "@/lib/api";
import { TournamentCard } from "@/components/TournamentCard";
import { TournamentModal } from "@/components/TournamentModal";
import { useState } from "react";
import { Building2, MapPin, Calendar } from "lucide-react";
import type { Tournament } from "@/lib/types";

export const Route = createFileRoute("/org/$orgId")({
  component: OrganizationPage,
});

function OrganizationPage() {
  const { orgId } = Route.useParams();
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);

  const { data: orgProfile, isLoading: loadingOrg } = useQuery({
    queryKey: ["org-profile", orgId],
    queryFn: () => getUserProfile(orgId),
  });

  const { data: allTournaments = [], isLoading: loadingTournaments } = useQuery({
    queryKey: ["tournaments"],
    queryFn: getTournaments,
  });

  const orgTournaments = allTournaments.filter(t => t.organizerId === orgId);

  if (loadingOrg || loadingTournaments) {
    return (
      <div className="flex-1 w-full max-w-7xl mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-muted-foreground">Loading organization data...</p>
      </div>
    );
  }

  if (!orgProfile || orgProfile.role !== "organization") {
    return (
      <div className="flex-1 w-full max-w-7xl mx-auto p-6 text-center py-20">
        <Building2 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Organization Not Found</h1>
        <p className="text-muted-foreground">The requested organization does not exist.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-background">
      {/* Branded Header */}
      <div className="w-full bg-gradient-to-b from-primary/10 to-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="h-32 w-32 rounded-full bg-surface border-4 border-background shadow-xl flex items-center justify-center overflow-hidden shrink-0">
              {orgProfile.organizationLogo ? (
                <img src={orgProfile.organizationLogo} alt={orgProfile.organizationName} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-12 w-12 text-primary/50" />
              )}
            </div>
            <div className="text-center md:text-left flex-1">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
                {orgProfile.organizationName || orgProfile.displayName || "Organization"}
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto md:mx-0">
                {orgProfile.organizationDescription || "Welcome to our official grass volleyball tournament hub. Join our upcoming events and be part of the community."}
              </p>
              
              <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4">
                <div className="inline-flex items-center text-sm font-medium bg-surface px-4 py-2 rounded-full border border-border">
                  <Calendar className="h-4 w-4 text-primary mr-2" />
                  {orgTournaments.length} Tournaments Hosted
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> 
            Upcoming & Past Events
          </h2>
        </div>

        {orgTournaments.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {orgTournaments.map(t => (
              <TournamentCard key={t.id} tournament={t} onClick={() => setActiveTournament(t)} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center rounded-2xl border border-dashed border-border bg-surface/50">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-medium text-foreground mb-1">No events yet</h3>
            <p className="text-muted-foreground">Check back later for new tournaments.</p>
          </div>
        )}
      </div>

      <TournamentModal tournament={activeTournament} open={!!activeTournament} onOpenChange={(v) => !v && setActiveTournament(null)} />
    </div>
  );
}
