import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, Loader2, Video, Star, Volleyball } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { subscribeToNotifications, markNotificationRead } from "@/lib/api";
import type { UserNotification } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ActivityFeed() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering dropdown item navigation
    try {
      await markNotificationRead(id);
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    try {
      await Promise.all(unread.map((n) => markNotificationRead(n.id)));
      toast.success("All notifications marked as read ✓");
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const getIcon = (type: UserNotification["type"]) => {
    switch (type) {
      case "video_processed":
        return <Video className="h-3.5 w-3.5 text-primary" />;
      case "highlight_received":
        return <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />;
      default:
        return <Volleyball className="h-3.5 w-3.5 text-emerald-500" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl hover:bg-muted/65 transition-colors border"
        >
          <Bell className="h-4.5 w-4.5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-black text-destructive-foreground ring-2 ring-background shadow-md">
              {unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications feed</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[300px] rounded-xl p-1 shadow-xl">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Activity Feed
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-[10px] font-bold text-primary hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        <div className="max-h-[260px] overflow-y-auto space-y-0.5 p-0.5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground italic">
              No recent notifications.
            </div>
          ) : (
            notifications.slice(0, 5).map((n) => (
              <DropdownMenuItem
                key={n.id}
                asChild
                className={cn(
                  "flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors focus:bg-muted/40",
                  !n.read ? "bg-primary/5 border border-primary/10" : ""
                )}
              >
                <Link to="/match/$matchId" params={{ matchId: n.matchId }}>
                  <div className="mt-0.5 h-6 w-6 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <p className="text-[11px] font-bold text-foreground leading-normal truncate">
                      {n.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed truncate">
                      {n.message}
                    </p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 self-center"
                      title="Mark as read"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="w-full text-center p-2 rounded-lg justify-center focus:bg-muted/40">
          <Link
            to="/profile"
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground block"
          >
            View all activity
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
