import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, startOfDay, isBefore } from "date-fns";
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createTournament } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TournamentStatus } from "@/lib/types";

const tournamentSchema = z.object({
  name: z.string().min(1, "Tournament name is required"),
  dateStart: z.date({
    required_error: "Start date is required",
  }).refine((date) => !isBefore(startOfDay(date), startOfDay(new Date())), {
    message: "Start date cannot be in the past",
  }),
  dateEnd: z.date({
    required_error: "End date is required",
  }),
  location: z.string().min(1, "Location is required"),
  format: z.string().min(1, "Format is required"),
  description: z.string().optional(),
  entryFee: z.number().min(0, "Entry fee must be at least 0"),
  maxTeams: z.number().min(2, "Must have at least 2 teams"),
}).refine((data) => !isBefore(startOfDay(data.dateEnd), startOfDay(data.dateStart)), {
  message: "End date must be after or equal to start date",
  path: ["dateEnd"],
});

type TournamentFormValues = z.infer<typeof tournamentSchema>;

export function CreateTournamentDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
  } = useForm<TournamentFormValues>({
    resolver: zodResolver(tournamentSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      name: "",
      location: "",
      format: "",
      description: "",
      entryFee: 50,
      maxTeams: 16,
    },
  });

  const dateStart = watch("dateStart");
  const dateEnd = watch("dateEnd");

  const mutation = useMutation({
    mutationFn: (data: TournamentFormValues) => {
      return createTournament({
        ...data,
        dateStart: data.dateStart.toISOString(),
        dateEnd: data.dateEnd.toISOString(),
        description: data.description || "",
        registeredTeams: [],
        status: "open" as TournamentStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament created successfully");
      setOpen(false);
      reset();
    },
    onError: (error) => {
      console.error("Failed to create tournament:", error);
      toast.error("Failed to create tournament");
    },
  });

  const onSubmit = (data: TournamentFormValues) => {
    mutation.mutate(data);
  };

  const onError = (errors: any) => {
    // Show each error as a toast
    Object.values(errors).forEach((error: any) => {
      toast.error(error.message || "Invalid input", {
        position: "bottom-right",
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> New tournament
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit, onError)}>
          <DialogHeader>
            <DialogTitle>Create New Tournament</DialogTitle>
            <DialogDescription>
              Enter the details for the new tournament. All dates are in AWST.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Tournament Name</Label>
              <Input
                id="name"
                placeholder="e.g. Summer Series #1"
                {...register("name")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      type="button"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateStart && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateStart ? format(dateStart, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateStart}
                      onSelect={(date) => date && setValue("dateStart", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      type="button"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateEnd && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateEnd ? format(dateEnd, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateEnd}
                      onSelect={(date) => date && setValue("dateEnd", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. City South Arena"
                {...register("location")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="format">Format</Label>
              <Input
                id="format"
                placeholder="e.g. Mixed 4s"
                {...register("format")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="entryFee">Entry Fee ($)</Label>
                <Input
                  id="entryFee"
                  type="number"
                  {...register("entryFee", { valueAsNumber: true })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxTeams">Max Teams</Label>
                <Input
                  id="maxTeams"
                  type="number"
                  {...register("maxTeams", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe the tournament rules, prizes, etc."
                className="min-h-[100px]"
                {...register("description")}
              />
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
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
