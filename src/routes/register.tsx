import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Volleyball } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: Register,
  head: () => ({ meta: [{ title: "Create account — Adelaide Grass Volleyball" }] }),
});

function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="absolute inset-0 [background:var(--gradient-hero)]" />

      <div className="relative w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-glow">
            <Volleyball className="h-5 w-5 text-primary-foreground" />
          </div>
        </Link>

        <div className="glass-strong rounded-2xl p-6">
          <h1 className="text-xl font-semibold tracking-tight">Join the comp</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your player account.</p>

          <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Full name</label>
              <Input placeholder="Alex Carter" className="mt-1 bg-background border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input type="email" placeholder="you@adelaide.com" className="mt-1 bg-background border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone (optional)</label>
              <Input type="tel" placeholder="04xx xxx xxx" className="mt-1 bg-background border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <Input type="password" placeholder="••••••••" className="mt-1 bg-background border-border" />
            </div>
            <Button className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-glow">
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have one? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
