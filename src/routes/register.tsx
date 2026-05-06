import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Volleyball } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const Route = createFileRoute("/register")({
  component: Register,
  head: () => ({ meta: [{ title: "Create account — Adelaide Grass Volleyball" }] }),
});

function Register() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithApple } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onSubmit",
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await updateProfile(userCredential.user, { displayName: data.name });
      toast.success("Account created successfully!");
      navigate({ to: "/home" });
    } catch (error: any) {
      toast.error(error.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
      navigate({ to: "/home" });
    } catch (error: any) {
      toast.error(error.message || "Google sign in failed.");
    }
  };

  const handleApple = async () => {
    try {
      await signInWithApple();
      navigate({ to: "/home" });
    } catch (error: any) {
      toast.error(error.message || "Apple sign in failed.");
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
          <h1 className="text-xl font-semibold tracking-tight">Join the comp</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your player account.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className={errors.name ? "text-xs font-medium text-destructive" : "text-xs font-medium text-muted-foreground"}>Full name</label>
              <Input 
                placeholder="Alex Carter" 
                className={cn("mt-1 bg-background border-border", errors.name ? "border-destructive" : "")} 
                {...register("name")}
              />
              {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
            </div>
            <div>
              <label className={errors.email ? "text-xs font-medium text-destructive" : "text-xs font-medium text-muted-foreground"}>Email</label>
              <Input 
                type="email" 
                placeholder="you@adelaide.com" 
                className={cn("mt-1 bg-background border-border", errors.email ? "border-destructive" : "")} 
                {...register("email")}
              />
              {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
            </div>
            <div>
              <label className={errors.password ? "text-xs font-medium text-destructive" : "text-xs font-medium text-muted-foreground"}>Password</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                className={cn("mt-1 bg-background border-border", errors.password ? "border-destructive" : "")} 
                {...register("password")}
              />
              {errors.password && <span className="text-xs text-destructive">{errors.password.message}</span>}
            </div>
            <Button disabled={loading} type="submit" className="w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-glow">
              {loading ? "Creating..." : "Create account"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={handleGoogle} className="w-full bg-background border-border hover:bg-muted">
              Google
            </Button>
            <Button variant="outline" onClick={handleApple} className="w-full bg-background border-border hover:bg-muted">
              Apple
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have one? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
