"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, ClipboardList, Users, Check, X, CheckCircle2, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type NotificationType = "BOOKING_PENDING" | "BOOKING_UPDATE" | "INVITE";

type NotificationItem =
  | {
      id: string;
      type: "BOOKING_PENDING";
      requiresAction: boolean;
      campSiteName: string;
      status: string;
      checkInDate?: string;
      checkOutDate?: string;
      href: string;
    }
  | {
      id: string;
      type: "BOOKING_UPDATE";
      requiresAction: false;
      campSiteName: string;
      status: string;
      updatedAt?: string;
      href: string;
    }
  | {
      id: string;
      type: "INVITE";
      requiresAction: boolean;
      campSiteName: string;
      role: string;
      invitedAt?: string;
    };

interface NotificationCenterProps {
  /** Operator (Host) booking notifications: pending bookings needing action. */
  showHostBookings?: boolean;
  /** Camper booking notifications: status updates from host (informational). */
  showCamperBookingUpdates?: boolean;
  /** Show team invites for the current user. */
  showInvites?: boolean;
  pollMs?: number;
  className?: string;
}

const SEEN_KEY = "campvibe:notifications:bookingUpdatesSeen";

function safeDateLabel(from?: string, to?: string) {
  try {
    if (!from || !to) return null;
    const fromD = new Date(from);
    const toD = new Date(to);
    if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) return null;
    return `${fromD.toLocaleDateString()} - ${toD.toLocaleDateString()}`;
  } catch {
    return null;
  }
}

export function NotificationCenter({
  showHostBookings = false,
  showCamperBookingUpdates = false,
  showInvites = true,
  pollMs = 30000,
  className,
}: NotificationCenterProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"action" | "all" | "bookings" | "invites">("action");
  const [isLoading, setIsLoading] = useState(true);
  const [hostBookings, setHostBookings] = useState<any[]>([]);
  const [camperBookings, setCamperBookings] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [hostRes, camperRes, invitesRes] = await Promise.all([
        showHostBookings ? fetch("/api/operator/bookings?status=PENDING") : Promise.resolve(null),
        showCamperBookingUpdates ? fetch("/api/bookings") : Promise.resolve(null),
        showInvites ? fetch("/api/team/invitations") : Promise.resolve(null),
      ]);

      if (hostRes && hostRes.ok) {
        const data = await hostRes.json();
        setHostBookings(Array.isArray(data) ? data : []);
      } else if (showHostBookings) {
        setHostBookings([]);
      }

      if (camperRes && camperRes.ok) {
        const data = await camperRes.json();
        setCamperBookings(Array.isArray(data) ? data : []);
      } else if (showCamperBookingUpdates) {
        setCamperBookings([]);
      }

      if (invitesRes && invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(Array.isArray(data) ? data : []);
      } else if (showInvites) {
        setInvites([]);
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
      setHostBookings([]);
      setCamperBookings([]);
      setInvites([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, pollMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHostBookings, showCamperBookingUpdates, showInvites, pollMs]);

  const bookingUpdateSeenMap = useMemo(() => {
    if (typeof window === "undefined") return {} as Record<string, string>;
    try {
      const raw = window.localStorage.getItem(SEEN_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }, [open]); // refresh when dropdown opens/closes

  const items: NotificationItem[] = useMemo(() => {
    const pendingItems: NotificationItem[] = showHostBookings
      ? hostBookings.map((b) => ({
          id: b.id,
          type: "BOOKING_PENDING",
          requiresAction: true,
          campSiteName: b?.campSite?.nameTh || b?.campSite?.nameEn || "Camp Site",
          status: (b.status || "PENDING").toUpperCase(),
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate,
          href: "/dashboard/bookings?status=PENDING",
        }))
      : [];

    const updateItems: NotificationItem[] = showCamperBookingUpdates
      ? camperBookings
          .filter((b) => {
            const status = (b.status || "").toUpperCase();
            // Status updates from host are typically CONFIRMED/CANCELLED/COMPLETED
            if (status === "PENDING") return false;
            const updatedAt = b.updatedAt ? new Date(b.updatedAt).toISOString() : "";
            const seenAt = bookingUpdateSeenMap[b.id];
            // If unseen OR updated since last seen => show
            return !seenAt || (updatedAt && updatedAt !== seenAt);
          })
          .map((b) => ({
            id: b.id,
            type: "BOOKING_UPDATE",
            requiresAction: false,
            campSiteName: b?.campSite?.nameTh || b?.campSite?.nameEn || "Camp Site",
            status: (b.status || "").toUpperCase(),
            updatedAt: b.updatedAt,
            href: "/bookings",
          }))
      : [];

    const inviteItems: NotificationItem[] = showInvites
      ? invites.map((i) => ({
          id: i.id,
          type: "INVITE",
          requiresAction: true,
          campSiteName: i?.campSite?.nameTh || i?.campSite?.nameEn || "Camp Site",
          role: i.role,
          invitedAt: i.invitedAt,
        }))
      : [];

    return [...inviteItems, ...updateItems, ...pendingItems];
  }, [
    hostBookings,
    camperBookings,
    invites,
    showHostBookings,
    showCamperBookingUpdates,
    showInvites,
    bookingUpdateSeenMap,
  ]);

  const counts = useMemo(() => {
    const byType: Record<NotificationType, number> = {
      BOOKING_PENDING: 0,
      BOOKING_UPDATE: 0,
      INVITE: 0,
    };
    let action = 0;
    items.forEach((it) => {
      byType[it.type] += 1;
      if (it.requiresAction) action += 1;
    });
    return { total: items.length, action, byType };
  }, [items]);

  const filtered = useMemo(() => {
    if (activeTab === "action") return items.filter((i) => i.requiresAction);
    if (activeTab === "bookings") return items.filter((i) => i.type === "BOOKING_PENDING" || i.type === "BOOKING_UPDATE");
    if (activeTab === "invites") return items.filter((i) => i.type === "INVITE");
    return items;
  }, [activeTab, items]);

  const handleInviteAction = async (inviteId: string, action: "ACCEPT" | "DECLINE") => {
    try {
      const res = await fetch(`/api/team/invitations/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return;
      await fetchAll();
    } catch (e) {
      console.error("Failed to update invitation", e);
    }
  };

  // Mark camper booking updates as "seen" when the dropdown is opened (informational notifications).
  useEffect(() => {
    if (!open) return;
    if (!showCamperBookingUpdates) return;
    if (typeof window === "undefined") return;

    try {
      const seen = window.localStorage.getItem(SEEN_KEY);
      const map: Record<string, string> = seen ? JSON.parse(seen) : {};

      items.forEach((it) => {
        if (it.type === "BOOKING_UPDATE" && it.updatedAt) {
          map[it.id] = new Date(it.updatedAt).toISOString();
        }
      });

      window.localStorage.setItem(SEEN_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative rounded-full", className)}
          aria-label={t.settings?.notifications || "Notifications"}
        >
          <Bell className="w-5 h-5" />
          {counts.total > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
              {counts.total > 9 ? "9+" : counts.total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[380px] rounded-2xl border border-border bg-card shadow-2xl mt-2 p-0 overflow-hidden"
      >
        <div className="p-4 pb-3 border-b border-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DropdownMenuLabel className="p-0 font-bold text-foreground">
                {t.settings?.notifications || "Notifications"}
              </DropdownMenuLabel>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-3">
            <TabsList className="w-full grid grid-cols-4 rounded-full overflow-hidden">
              <TabsTrigger value="action" className="rounded-full px-2 text-xs min-w-0">
                <span className="truncate">{(t as any).common?.action || "Action"}</span>
              </TabsTrigger>
              <TabsTrigger value="all" className="rounded-full px-2 text-xs min-w-0">
                <span className="truncate">{(t as any).common?.all || "All"}</span>
              </TabsTrigger>
              <TabsTrigger value="bookings" className="rounded-full px-2 text-xs min-w-0">
                <span className="truncate">{t.dashboard?.bookings || "Bookings"}</span>
              </TabsTrigger>
              <TabsTrigger value="invites" className="rounded-full px-2 text-xs min-w-0">
                <span className="truncate">{t.settings?.team || "Team"}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-3">
              {isLoading ? (
                <div className="py-8 text-sm text-muted-foreground text-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="text-sm font-semibold text-foreground">
                    {(t as any).common?.noNotifications || "No new notifications"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(t as any).common?.checkBackLater || "Check back later."}
                  </div>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  {filtered.map((item) => {
                    if (item.type === "INVITE") {
                      return (
                        <div key={item.id} className="px-4 py-3 border-t border-border/50">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-foreground">
                                  {(t as any).common?.teamInvite || "Team invite"}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.campSiteName}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {(t as any).common?.role || "Role"}: <span className="font-medium">{item.role}</span>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full w-full justify-center gap-2"
                                  onClick={() => handleInviteAction(item.id, "DECLINE")}
                                >
                                  <X className="w-4 h-4" />
                                  {(t as any).common?.decline || "Decline"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="rounded-full w-full justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                                  onClick={() => handleInviteAction(item.id, "ACCEPT")}
                                >
                                  <Check className="w-4 h-4" />
                                  {(t as any).common?.accept || "Accept"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (item.type === "BOOKING_UPDATE") {
                      const status = item.status;
                      const isConfirmed = status === "CONFIRMED" || status === "COMPLETED";
                      const isCancelled = status === "CANCELLED";

                      return (
                        <div key={item.id} className="px-4 py-3 border-t border-border/50">
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "mt-0.5 w-9 h-9 rounded-full flex items-center justify-center",
                                isConfirmed && "bg-emerald-600/10 text-emerald-700",
                                isCancelled && "bg-destructive/10 text-destructive",
                                !isConfirmed && !isCancelled && "bg-muted text-muted-foreground"
                              )}
                            >
                              {isConfirmed ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : isCancelled ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <ClipboardList className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-foreground">
                                {(t as any).common?.bookingStatusUpdated || "Booking status updated"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.campSiteName}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {(t as any).common?.status || "Status"}:{" "}
                                <span className={cn("font-semibold", isConfirmed && "text-emerald-700", isCancelled && "text-destructive")}>
                                  {status}
                                </span>
                              </div>
                              <div className="mt-3 flex items-center justify-end">
                                <Link href={item.href}>
                                  <Button variant="outline" size="sm" className="rounded-full">
                                    {(t as any).common?.view || "View"}
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const dateLabel = safeDateLabel(item.checkInDate, item.checkOutDate);
                    return (
                      <div key={item.id} className="px-4 py-3 border-t border-border/50">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 w-9 h-9 rounded-full bg-secondary/15 text-secondary flex items-center justify-center">
                            <ClipboardList className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground">
                                {(t as any).common?.newBooking || "New Booking"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.campSiteName}
                              </div>
                              {dateLabel ? (
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  {dateLabel}
                                </div>
                              ) : null}
                            </div>

                            {/* Primary action aligned right, vertically centered */}
                            <div className="shrink-0 pt-0.5 self-center">
                              <Link href={item.href}>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-5"
                                >
                                  {(t as any).common?.review || "Review"}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer actions */}
        {((showHostBookings || showCamperBookingUpdates) || showInvites) && (
          <div className="p-3">
            <Button variant="outline" className="rounded-full w-full" onClick={() => fetchAll()}>
              {(t as any).common?.refresh || "Refresh"}
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

