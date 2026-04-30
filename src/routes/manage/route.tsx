import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/manage")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <Outlet />;
}
