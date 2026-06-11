import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Copy, Check, ArrowRight, QrCode } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
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
import { createCasualMatch } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const createMatchSchema = z.object({
  label: z.string().min(1, "Match label is required"),
  pointTarget: z.number().min(1, "Point target must be at least 1").max(100, "Point target cannot exceed 100"),
});

type CreateMatchFormValues = z.infer<typeof createMatchSchema>;

interface CreatedMatchInfo {
  id: string;
  joinCodeA: string;
  joinCodeB: string;
  label: string;
}

export function CreateMatchDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "codes">("input");
  const [createdMatch, setCreatedMatch] = useState<CreatedMatchInfo | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<CreateMatchFormValues>({
    resolver: zodResolver(createMatchSchema),
    defaultValues: {
      label: "",
      pointTarget: 21,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CreateMatchFormValues) => {
      if (!userProfile?.id) throw new Error("Unauthorized");
      
      // We need to generate the join codes during creation in API
      const matchId = await createCasualMatch(userProfile.id, {
        label: data.label,
        pointTarget: data.pointTarget,
      });

      // Fetch the created match details (or fetch enough to show codes)
      // Since createCasualMatch generates join codes inside the Firestore doc, we query it back
      const response = await fetch(`${window.location.origin}/api/match/${matchId}`).catch(() => null);
      // Wait, we can retrieve it directly from Firestore inside the mutation to be fast:
      const { getMatch } = await import("@/lib/api");
      const match = await getMatch(matchId);
      if (!match) throw new Error("Failed to retrieve created match");

      return {
        id: matchId,
        joinCodeA: match.joinCodeA || "",
        joinCodeB: match.joinCodeB || "",
        label: match.label || data.label,
      };
    },
    onSuccess: (data) => {
      toast.success("Match created successfully!");
      setCreatedMatch(data);
      setStep("codes");
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (error) => {
      console.error("Failed to create match:", error);
      toast.error("Failed to create match");
    },
  });

  const onSubmit = (data: CreateMatchFormValues) => {
    mutation.mutate(data);
  };

  const handleCopy = (code: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    toast.success(`Copied join link for Team ${code === createdMatch?.joinCodeA ? "A" : "B"}!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after transition
    setTimeout(() => {
      setStep("input");
      setCreatedMatch(null);
      reset();
    }, 300);
  };

  const handleStartScoring = () => {
    if (!createdMatch) return;
    setOpen(false);
    const id = createdMatch.id;
    // Reset state
    setTimeout(() => {
      setStep("input");
      setCreatedMatch(null);
      reset();
    }, 300);
    navigate({ to: "/manage/score/$matchId", params: { matchId: id } });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 rounded-xl">
          <Plus className="h-4 w-4" />
          Create Match
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {step === "input" ? (
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create Casual Match</DialogTitle>
              <DialogDescription>
                Set up a new casual match for Sunday. Players will join Team A or Team B using their phones.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="label">Match Title / Label</Label>
                <Input
                  id="label"
                  placeholder="e.g. Game 1 — Sunday Morning"
                  {...register("label")}
                  disabled={mutation.isPending}
                />
                {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pointTarget">Point Target</Label>
                <Input
                  id="pointTarget"
                  type="number"
                  placeholder="21"
                  {...register("pointTarget", { valueAsNumber: true })}
                  disabled={mutation.isPending}
                />
                {errors.pointTarget && <p className="text-xs text-destructive">{errors.pointTarget.message}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
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
                    Creating...
                  </>
                ) : (
                  "Create Match"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div>
            <DialogHeader>
              <DialogTitle>Match Created!</DialogTitle>
              <DialogDescription>
                Share these codes or QR codes with players courtside so they can join Team A or Team B.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-6 py-6">
              {/* Team A Join Panel */}
              <div className="flex flex-col items-center p-4 rounded-xl border border-primary/10 bg-primary/5">
                <span className="text-xs font-semibold tracking-wide text-primary uppercase mb-2">Team A</span>
                <span className="text-3xl font-extrabold tracking-wider text-foreground select-all font-mono">
                  {createdMatch?.joinCodeA}
                </span>
                
                <div className="p-3 bg-white rounded-lg my-4 shadow-sm border">
                  {createdMatch && (
                    <QRCodeSVG
                      value={`${window.location.origin}/join/${createdMatch.joinCodeA}`}
                      size={120}
                      level="M"
                    />
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2 text-xs"
                  onClick={() => createdMatch && handleCopy(createdMatch.joinCodeA, `${window.location.origin}/join/${createdMatch.joinCodeA}`)}
                >
                  {copiedCode === createdMatch?.joinCodeA ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>

              {/* Team B Join Panel */}
              <div className="flex flex-col items-center p-4 rounded-xl border border-destructive/10 bg-destructive/5">
                <span className="text-xs font-semibold tracking-wide text-destructive uppercase mb-2">Team B</span>
                <span className="text-3xl font-extrabold tracking-wider text-foreground select-all font-mono">
                  {createdMatch?.joinCodeB}
                </span>
                
                <div className="p-3 bg-white rounded-lg my-4 shadow-sm border">
                  {createdMatch && (
                    <QRCodeSVG
                      value={`${window.location.origin}/join/${createdMatch.joinCodeB}`}
                      size={120}
                      level="M"
                    />
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full flex items-center justify-center gap-2 text-xs"
                  onClick={() => createdMatch && handleCopy(createdMatch.joinCodeB, `${window.location.origin}/join/${createdMatch.joinCodeB}`)}
                >
                  {copiedCode === createdMatch?.joinCodeB ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleClose}
              >
                Close (Keep Active)
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto flex items-center justify-center gap-2"
                onClick={handleStartScoring}
              >
                Go to Scoring
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
