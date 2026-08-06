"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, ClipboardList, Users, Check, X, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
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
import { ErrorBanner } from "@/components/ui/error-banner";
import { cn } from "@/lib/utils";
import { fetchJsonSafe, type SafeJsonResult } from "@/lib/safe-fetch";
import type { NotificationDTO } from "@/types/api";

type NotificationItem =
  | {
      id: string;
      type: "NOTIFICATION";
      // CAM-684: a persisted row (GET /api/notifications) never has a verb
      // (accept/decline lives on invites only), so it is never "action" in
      // that sense — but the Action tab means "needs your attention", and
      // an UNREAD row still does. It drops off the Action tab the moment
      // it is opened (isRead flips), while staying visible under All/Bookings.
      requiresAction: boolean;
      title: string;
      body?: string | null;
      link?: string | null;
      isRead: boolean;
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
  /** Camper booking notifications: status updates from host (informational). */
  showCamperBookingUpdates?: boolean;
  /** Show team invites for the current user. */
  showInvites?: boolean;
  pollMs?: number;
  className?: string;
}

const SEEN_KEY = "campvibe:notifications:bookingUpdatesSeen";

export function NotificationCenter({
  showCamperBookingUpdates = false,
  showInvites = true,
  pollMs = 30000,
  className,
}: NotificationCenterProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"action" | "all" | "bookings" | "invites">("action");
  const [isLoading, setIsLoading] = useState(true);
  // CAM-684: host booking items now come from the caller's own persisted
  // rows (GET /api/notifications) instead of being derived from the
  // operator's pending-bookings list — that derived fetch and its
  // visibility-gating prop are gone. Always fetched (scoped server-side to
  // the caller, so it is safe/cheap for a camper too).
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [camperBookings, setCamperBookings] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  // CAM-616: notifications/camperBookings/invites are THREE INDEPENDENT
  // sources that used to share one try/catch (the CAM-362 anti-pattern) —
  // one source's hiccup wiped every list to [], so a host with real pending
  // booking requests saw "no new notifications" during an outage. Each
  // source now fails into its OWN flag via the never-throwing
  // fetchJsonSafe (lib/safe-fetch.ts, the CAM-362/555 sanctioned shape);
  // its list is left untouched (not wiped) on failure so a transient error
  // never erases data that already loaded.
  const [notificationsError, setNotificationsError] = useState(false);
  const [camperBookingsError, setCamperBookingsError] = useState(false);
  const [invitesError, setInvitesError] = useState(false);
  const hasLoadError = notificationsError || camperBookingsError || invitesError;

  const fetchAll = async () => {
    setIsLoading(true);

    const skip: SafeJsonResult<any[]> = { ok: true, data: [] };
    const [notificationsResult, camperResult, invitesResult] = await Promise.all([
      fetchJsonSafe<NotificationDTO[]>("/api/notifications"),
      showCamperBookingUpdates ? fetchJsonSafe<any[]>("/api/bookings") : Promise.resolve(skip),
      showInvites ? fetchJsonSafe<any[]>("/api/team/invitations") : Promise.resolve(skip),
    ]);

    if (notificationsResult.ok) {
      setNotifications(Array.isArray(notificationsResult.data) ? notificationsResult.data : []);
      setNotificationsError(false);
    } else {
      setNotificationsError(true);
    }

    if (showCamperBookingUpdates) {
      if (camperResult.ok) {
        setCamperBookings(Array.isArray(camperResult.data) ? camperResult.data : []);
        setCamperBookingsError(false);
      } else {
        setCamperBookingsError(true);
      }
    }

    if (showInvites) {
      if (invitesResult.ok) {
        setInvites(Array.isArray(invitesResult.data) ? invitesResult.data : []);
        setInvitesError(false);
      } else {
        setInvitesError(true);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, pollMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCamperBookingUpdates, showInvites, pollMs]);

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
    const notificationItems: NotificationItem[] = notifications.map((n) => ({
      id: n.id,
      type: "NOTIFICATION",
      requiresAction: !n.isRead,
      title: n.title,
      body: n.body,
      link: n.link,
      isRead: n.isRead,
    }));

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

    return [...inviteItems, ...updateItems, ...notificationItems];
  }, [
    notifications,
    camperBookings,
    invites,
    showCamperBookingUpdates,
    showInvites,
    bookingUpdateSeenMap,
  ]);

  // CAM-684: the bell badge counts UNREAD only — updateItems/inviteItems are
  // already filtered down to "needs your attention" (unseen / pending), so
  // they count in full; a persisted NOTIFICATION item only counts while
  // isRead is false (the list itself still shows read rows as history).
  const counts = useMemo(() => {
    let total = 0;
    items.forEach((it) => {
      if (it.type === "NOTIFICATION") {
        if (!it.isRead) total += 1;
      } else {
        total += 1;
      }
    });
    return { total };
  }, [items]);

  const filtered = useMemo(() => {
    if (activeTab === "action") return items.filter((i) => i.requiresAction);
    if (activeTab === "bookings") return items.filter((i) => i.type === "NOTIFICATION" || i.type === "BOOKING_UPDATE");
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

  // CAM-684: opening a persisted notification marks it read and decrements
  // the badge immediately (no full refetch) — an optimistic local update.
  // If the PATCH silently fails, the next 30s poll re-fetches the real
  // server state and reconciles (no manual rollback needed).
  const handleOpenNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {
      // ignore — the next poll reconciles from the server
    });
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
          className={cn("relative rounded-full h-11 w-11", className)}
          aria-label={t.settings?.notifications || "Notifications"}
        >
          <Bell className="w-5 h-5" />
          {counts.total > 0 && (
            <span
              className="absolute top-0 right-0 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center"
              aria-label={(t as any).notifications?.unreadCountAria?.replace('{count}', String(counts.total)) || `${counts.total} unread`}
            >
              {counts.total > 9 ? "9+" : counts.total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] sm:w-[380px] rounded-2xl border border-border bg-card shadow-2xl p-0 overflow-hidden"
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
                <span className="truncate">{t.common.all}</span>
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
              ) : (
                <>
                  {/* CAM-616/684: a source failure must be VISIBLE alongside
                      any sibling data that DID load — never swallowed into
                      the plain empty copy, and never hidden just because
                      another source (e.g. invites) rendered fine. */}
                  {hasLoadError && (
                    <div className="px-4 pb-2 flex flex-col items-start gap-2">
                      <ErrorBanner
                        message={(t as any).notifications?.loadError || "Couldn't load notifications"}
                        data-testid="banner--notifications-error"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => fetchAll()}
                        data-testid="btn--notifications-retry"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                        {t.common.retry}
                      </Button>
                    </div>
                  )}

                  {filtered.length === 0 ? (
                    hasLoadError ? null : (
                      <div className="py-10 text-center">
                        <div className="text-sm font-semibold text-foreground">
                          {(t as any).common?.noNotifications || "No new notifications"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(t as any).common?.checkBackLater || "Check back later."}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                  {filtered.map((item) => {
                    if (item.type === "INVITE") {
                      return (
                        <div key={item.id} className="px-4 py-2 border-t border-border/50">
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
                                  className="h-9 rounded-full w-full justify-center gap-2"
                                  onClick={() => handleInviteAction(item.id, "DECLINE")}
                                >
                                  <X className="w-4 h-4" />
                                  {(t as any).common?.decline || "Decline"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-9 rounded-full w-full justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
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
                        <div key={item.id} className="px-4 py-2 border-t border-border/50">
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "mt-0.5 w-9 h-9 rounded-full flex items-center justify-center",
                                isConfirmed && "bg-success/10 text-success",
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
                                <span className={cn("font-semibold", isConfirmed && "text-success", isCancelled && "text-destructive")}>
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

                    // item.type === "NOTIFICATION" — a persisted row from
                    // GET /api/notifications (CAM-684). title/body are
                    // already Thai, composed server-side — rendered as
                    // stored, never re-translated client-side.
                    const iconToneClass = item.isRead
                      ? "bg-muted text-muted-foreground"
                      : "bg-secondary/10 text-secondary";
                    const titleToneClass = item.isRead
                      ? "font-normal text-muted-foreground"
                      : "font-semibold text-foreground";
                    const rowContent = (
                      <div className="flex items-start gap-3">
                        <div className={cn("mt-0.5 w-9 h-9 rounded-full flex items-center justify-center", iconToneClass)}>
                          <ClipboardList className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {!item.isRead && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
                            )}
                            <div className={cn("text-sm truncate", titleToneClass)}>{item.title}</div>
                          </div>
                          {item.body ? (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</div>
                          ) : null}
                        </div>
                      </div>
                    );
                    const rowClassName =
                      "block w-full text-start px-4 py-2 border-t border-border/50 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
                    const markReadOnOpen = () => {
                      if (!item.isRead) handleOpenNotification(item.id);
                    };

                    return item.link ? (
                      <Link key={item.id} href={item.link} onClick={markReadOnOpen} className={rowClassName}>
                        {rowContent}
                      </Link>
                    ) : (
                      <button key={item.id} type="button" onClick={markReadOnOpen} className={rowClassName}>
                        {rowContent}
                      </button>
                    );
                  })}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer actions */}
        <div className="p-3">
          <Button variant="outline" className="rounded-full w-full" onClick={() => fetchAll()}>
            {(t as any).common?.refresh || "Refresh"}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

