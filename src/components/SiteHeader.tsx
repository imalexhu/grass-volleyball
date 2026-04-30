import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Volleyball, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function SiteHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 glass-strong">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow shadow-glow transition-transform group-hover:scale-105">
            <Volleyball className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">
            Adelaide<span className="text-primary"> Grass</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: "px-3 py-2 text-sm text-foreground" }}
          >
            Home
          </Link>
          <Link
            to="/home"
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: "px-3 py-2 text-sm text-foreground" }}
          >
            Tournaments
          </Link>
          {user && (
            <Link
              to="/manage"
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "px-3 py-2 text-sm text-foreground" }}
            >
              Manage
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => logout()} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-glow">
                <Link to="/register">Join</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
