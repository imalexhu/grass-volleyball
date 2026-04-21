import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Edit2, Calendar as CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, startOfDay, isBefore, parseISO } from "date-fns";
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { updateTournament } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tournament, TournamentStatus } from "@/lib/types";

const tournamentSchema = z.object({
  name: z.string().min(1, "Tournament name is required"),
  dateStart: z.date({
    required_error: "Start date is required",
  }),
  dateEnd: z.date({
    required_error: "End date is required",
  }),
  location: z.string().min(1, "Location is required"),
  format: z.string().min(1, "Format is required"),
  description: z.string().optional(),
  entryFee: z.number().min(0, "Entry fee must be at least 0"),
  maxTeams: z.number().min(2, "Must have at least 2 teams"),
  status: z.enum(["open", "filled", "complete"]),
}).refine((data) => !isBefore(startOfDay(data.dateEnd), startOfDay(data.dateStart)), {
  message: "End date must be after or equal to start date",
  path: ["dateEnd"],
});

type TournamentFormValues = z.infer<typeof tournamentSchema>;

interface EditTournamentDialogProps {
  tournament: Tournament;
}

export function EditTournamentDialog({ tournament }: EditTournamentDialogProps) {
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
      name: tournament.name,
      dateStart: parseISO(tournament.dateStart),
      dateEnd: parseISO(tournament.dateEnd),
      location: tournament.location,
      format: tournament.format,
      description: tournament.description || "",
      entryFee: tournament.entryFee,
      maxTeams: tournament.maxTeams,
      status: tournament.status,
    },
  });

  // Update form data if tournament changes
  useEffect(() => {
    if (open) {
      reset({
        name: tournament.name,
        dateStart: parseISO(tournament.dateStart),
        dateEnd: parseISO(tournament.dateEnd),
        location: tournament.location,
        format: tournament.format,
        description: tournament.description || "",
        entryFee: tournament.entryFee,
        maxTeams: tournament.maxTeams,
        status: tournament.status,
      });
    }
  }, [tournament, open, reset]);

  const dateStart = watch("dateStart");
  const dateEnd = watch("dateEnd");
  const status = watch("status");

  const mutation = useMutation({
    mutationFn: (data: TournamentFormValues) => {
      return updateTournament(tournament.id, {
        ...data,
        dateStart: data.dateStart.toISOString(),
        dateEnd: data.dateEnd.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament updated successfully");
      setOpen(false);
    },
    onError: (error) => {
      console.error("Failed to update tournament:", error);
      toast.error("Failed to update tournament");
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
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit, onError)}>
          <DialogHeader>
            <DialogTitle>Edit Tournament</DialogTitle>
            <DialogDescription>
              Update the details for "{tournament.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Tournament Name</Label>
              <Input
                id="edit-name"
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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={status} onValueChange={(value) => setValue("status", value as TournamentStatus)}>
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="filled">Filled</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  {...register("location")}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-format">Format</Label>
              <Input
                id="edit-format"
                {...register("format")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-entryFee">Entry Fee ($)</Label>
                <Input
                  id="edit-entryFee"
                  type="number"
                  {...register("entryFee", { valueAsNumber: true })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-maxTeams">Max Teams</Label>
                <Input
                  id="edit-maxTeams"
                  type="number"
                  {...register("maxTeams", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
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
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
