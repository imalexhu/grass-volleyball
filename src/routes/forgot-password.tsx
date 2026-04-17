import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Volleyball } from "lucide-react";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
  head: () => ({ meta: [{ title: "Reset password — Adelaide Grass Volleyball" }] }),
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Please enter your email.");
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      toast.success("Password reset email sent.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

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
          {!sent ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Forgot password</h1>
              <p className="text-sm text-muted-foreground mt-1">Enter your email to receive a reset link.</p>

              <form className="mt-6 space-y-4" onSubmit={handleReset}>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input 
                    type="email" 
                    placeholder="you@adelaide.com" 
                    className="mt-1 bg-background border-border" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button disabled={loading} className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-glow">
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
              <p className="text-sm text-muted-foreground mt-2">
                We've sent a password reset link to <span className="font-semibold">{email}</span>.
              </p>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Remembered it? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
