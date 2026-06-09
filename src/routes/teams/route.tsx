import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/teams")({
  component: TeamsLayout,
});

function TeamsLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Outlet />;
}