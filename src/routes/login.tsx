import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Volleyball } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({ meta: [{ title: "Sign in — Adelaide Grass Volleyball" }] }),
});

function Login() {
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
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to register your team.</p>

          <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input type="email" placeholder="you@adelaide.com" className="mt-1 bg-background border-border" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <Link to="/login" className="text-xs text-primary hover:underline">Forgot?</Link>
              </div>
              <Input type="password" placeholder="••••••••" className="mt-1 bg-background border-border" />
            </div>
            <Button className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-glow">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            New here? <Link to="/register" className="text-primary hover:underline">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
