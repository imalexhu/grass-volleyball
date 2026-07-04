import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  User, 
  onAuthStateChanged, 
  signOut, 
  GoogleAuthProvider, 
  OAuthProvider, 
  signInWithRedirect,
  getRedirectResult
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile, createUserProfile } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle redirect sign-in result on load
    getRedirectResult(auth)
      .catch((error) => {
        console.error("Error in getRedirectResult:", error);
        toast.error("Sign in failed: " + error.message);
      });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          let profile = await getUserProfile(user.uid);
          if (!profile) {
            profile = {
              id: user.uid,
              email: user.email,
              displayName: user.displayName,
              role: "player" as const,
              teamIds: [],
              joinedAt: Date.now(),
            };
            await createUserProfile(profile);
          }
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
      } catch (error) {
        console.error("Error in onAuthStateChanged profile fetching:", error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  };

  const signInWithApple = async () => {
    const provider = new OAuthProvider("apple.com");
    await signInWithRedirect(auth, provider);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout, signInWithGoogle, signInWithApple }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
