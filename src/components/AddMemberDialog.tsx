import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTeamMember, searchUsers } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { toast } from "sonner";

export function AddMemberDialog({ teamId, onSuccess }: { teamId: string; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await searchUsers(query);
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedUser) throw new Error("No user selected");
      return addTeamMember(teamId, selectedUser.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      toast.success(`${selectedUser?.displayName} added to team!`);
      setOpen(false);
      setQuery("");
      setResults([]);
      setSelectedUser(null);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add member");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-border">
          <UserPlus className="h-4 w-4 mr-2" /> Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Search for a player by name or email to add them to your team.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-background border-border"
            autoFocus
          />
        </div>

        <div className="max-h-[200px] overflow-y-auto space-y-1">
          {searching ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length > 0 ? (
            results.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-3 transition-colors hover:bg-muted/50 ${
                  selectedUser?.id === u.id ? "bg-primary/10 border border-primary/30" : "border border-transparent"
                }`}
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {u.displayName?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{u.displayName || "Unknown"}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>
                </div>
              </button>
            ))
          ) : query.trim() ? (
            <p className="text-xs text-muted-foreground text-center py-4 italic">No players found</p>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Type a name or email to search</p>
          )}
        </div>

        {selectedUser && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <span className="text-xs font-medium flex-1">
              Selected: <strong>{selectedUser.displayName}</strong>
            </span>
            <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!selectedUser || mutation.isPending}
            className="min-w-[100px]"
          >
            {mutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
            ) : (
              "Add Member"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}