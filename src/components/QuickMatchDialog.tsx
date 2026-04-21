import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Zap, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMatch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

const quickMatchSchema = z.object({
  teamA: z.string().min(1, "Team A name is required"),
  teamB: z.string().min(1, "Team B name is required"),
  court: z.number().min(1, "Court number is required"),
});

type QuickMatchFormValues = z.infer<typeof quickMatchSchema>;

export function QuickMatchDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<QuickMatchFormValues>({
    resolver: zodResolver(quickMatchSchema),
    defaultValues: {
      teamA: "Team A",
      teamB: "Team B",
      court: 1,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: QuickMatchFormValues) => {
      return createMatch({
        teamA: data.teamA,
        teamB: data.teamB,
        court: data.court,
        stage: "final", // Generic stage for quick match
        scheduledAt: new Date().toISOString(),
        status: "scheduled",
      });
    },
    onSuccess: (matchId) => {
      toast.success("Quick match started!");
      setOpen(false);
      reset();
      navigate({ to: "/admin/score/$matchId", params: { matchId } });
    },
    onError: (error) => {
      console.error("Failed to start quick match:", error);
      toast.error("Failed to start quick match");
    },
  });

  const onSubmit = (data: QuickMatchFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
          )}
        >
          <span className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-primary" />
            Quick Match
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Start Quick Match</DialogTitle>
            <DialogDescription>
              Enter the names of the teams and the court number to start a new match.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="teamA">Team A Name</Label>
                <Input
                  id="teamA"
                  placeholder="Team A"
                  {...register("teamA")}
                />
                {errors.teamA && <p className="text-xs text-destructive">{errors.teamA.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="teamB">Team B Name</Label>
                <Input
                  id="teamB"
                  placeholder="Team B"
                  {...register("teamB")}
                />
                {errors.teamB && <p className="text-xs text-destructive">{errors.teamB.message}</p>}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="court">Court Number</Label>
              <Input
                id="court"
                type="number"
                {...register("court", { valueAsNumber: true })}
              />
              {errors.court && <p className="text-xs text-destructive">{errors.court.message}</p>}
            </div>
          </div>
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
              type="submit"
              disabled={mutation.isPending}
              className="min-w-[120px]"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Match"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
