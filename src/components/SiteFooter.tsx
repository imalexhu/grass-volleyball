import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/20 py-12 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-8">
        <div className="flex flex-col items-center sm:items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center">
               <Trophy className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-black tracking-tighter">AGV</span>
          </div>
          <p className="text-sm text-muted-foreground">Season 2026 · Adelaide, South Australia</p>
        </div>
        <div className="flex gap-8 text-sm font-bold uppercase tracking-widest text-muted-foreground flex-wrap justify-center">
           <Link to="/home" className="hover:text-primary transition-colors">Tournaments</Link>
           <Link to="/login" className="hover:text-primary transition-colors">Login</Link>
           <Link to="/register" className="hover:text-primary transition-colors">Join</Link>
           <Link to="/policy" className="hover:text-primary transition-colors">Privacy</Link>
           <Link to="/tos" className="hover:text-primary transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
