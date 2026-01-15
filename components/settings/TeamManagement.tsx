"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, UserPlus, Mail, Phone, Shield, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { toast } from "sonner";
import { AddMemberDialog } from "./AddMemberDialog";
import { PermissionTooltip } from "@/components/ui/permission-tooltip";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TeamMember {
    id: string;
    role: string;
    permissions?: string[];
    invitedAt: string;
    acceptedAt: string | null;
    isActive: boolean;
    user: {
        id: string;
        name: string | null;
        email: string;
        phone: string | null;
        image: string | null;
    };
}

interface TeamManagementProps {
    campSiteId: string;
}

export function TeamManagement({ campSiteId }: TeamManagementProps) {
    const { t } = useLanguage();
    const ts = (t as any).settings;
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [hoveredRoleMemberId, setHoveredRoleMemberId] = useState<string | null>(null);

    // Fetch current user ID
    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                if (data?.user?.id) {
                    setCurrentUserId(data.user.id);
                }
            })
            .catch(err => console.error("Failed to fetch user session:", err));
    }, []);

    // Fetch team members when camp site changes
    useEffect(() => {
        if (!campSiteId) return;

        setLoading(true);
        fetch(`/api/team/members?campSiteId=${campSiteId}`)
            .then(res => res.json())
            .then(data => {
                // API returns data directly (not wrapped in { success, data })
                if (Array.isArray(data)) {
                    setMembers(data);
                    console.log('✅ Loaded team members:', data.length);
                } else if (data.error) {
                    console.error('API Error:', data.error);
                    toast.error(data.error);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch team members:", err);
                toast.error("Failed to load team members");
                setLoading(false);
            });
    }, [campSiteId]);

    const handleUpdateRole = async (memberId: string, newRole: string) => {
        try {
            const res = await fetch(`/api/team/members/${memberId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });

            const data = await res.json();

            if (res.ok) {
                setMembers(prev => prev.map(m => 
                    m.id === memberId ? { ...m, role: newRole } : m
                ));
                toast.success(ts?.roleUpdated || "Role updated successfully");
            } else {
                toast.error(data.error || "Failed to update role");
            }
        } catch (error) {
            console.error("Update role error:", error);
            toast.error("An error occurred");
        }
    };

    const handleDeleteMember = async () => {
        if (!memberToDelete) return;

        try {
            const res = await fetch(`/api/team/members/${memberToDelete.id}`, {
                method: 'DELETE'
            });

            const data = await res.json();

            if (res.ok) {
                setMembers(prev => prev.filter(m => m.id !== memberToDelete.id));
                toast.success(ts?.memberRemoved || "Member removed successfully");
                setMemberToDelete(null);
            } else {
                toast.error(data.error || "Failed to remove member");
            }
        } catch (error) {
            console.error("Delete member error:", error);
            toast.error("An error occurred");
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            // NOTE: add hover:bg-* to override Badge variant hover styles so colors don't shift on row hover
            case 'OWNER': return 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100';
            case 'ADMIN': return 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100';
            case 'MANAGER': return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100';
            case 'STAFF': return 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100';
            case 'VIEWER': return 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100';
            default: return 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100';
        }
    };

    const getRoleDescription = (role: string) => {
        switch (role) {
            case "OWNER": return (t as any).settings?.ownerDesc || "Full access (owner).";
            case "ADMIN": return (t as any).settings?.adminDesc || "Full access except owner privileges.";
            case "MANAGER": return (t as any).settings?.managerDesc || "Manage bookings and view analytics.";
            case "STAFF": return (t as any).settings?.staffDesc || "View and update bookings only.";
            case "VIEWER": return (t as any).settings?.viewerDesc || "Read-only access.";
            default: return "";
        }
    };

    const getRoleDefaultPermissions = (role: string): string[] => {
        // This is a UI summary (not enforcement). Real enforcement should check permissions server-side.
        switch (role) {
            case "OWNER":
                return [
                    "Camp site: view / update / delete",
                    "Bookings: view / create / update / delete",
                    "Team: view / invite / update roles / remove",
                    "Analytics: view",
                    "Financial: view",
                ];
            case "ADMIN":
                return [
                    "Camp site: view / update",
                    "Bookings: view / create / update / cancel",
                    "Team: view / invite / update roles / remove",
                    "Analytics: view",
                ];
            case "MANAGER":
                return [
                    "Camp site: view",
                    "Bookings: view / update",
                    "Team: view",
                    "Analytics: view",
                ];
            case "STAFF":
                return [
                    "Camp site: view",
                    "Bookings: view / update",
                ];
            case "VIEWER":
            default:
                return [
                    "Camp site: view",
                    "Bookings: view",
                ];
        }
    };

    const getPermissionLines = (member: TeamMember) => {
        if (Array.isArray(member.permissions) && member.permissions.length > 0) {
            // If we have explicit permissions, show those (raw codes for now).
            return member.permissions.map((p) => p.replaceAll("_", " ").toLowerCase());
        }
        return getRoleDefaultPermissions(member.role);
    };

    return (
        <div className="space-y-6">
            {/* Add Member Button */}
            <div className="flex items-center justify-end">
                <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="rounded-full bg-primary hover:bg-primary/90 shadow-sm"
                >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {ts?.addMember || "Add Member"}
                </Button>
            </div>

            {/* Team Members List */}
            {loading ? (
                <TableSkeleton rows={3} />
            ) : (
                <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-muted/40 border-b border-border/60">
                                    <th className="px-6 py-4 font-semibold text-muted-foreground">
                                        {ts?.member || "Member"}
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-muted-foreground">
                                        {ts?.contact || "Contact"}
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-muted-foreground">
                                        {ts?.role || "Role"}
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-muted-foreground">
                                        {ts?.status || "Status"}
                                    </th>
                                    <th className="px-6 py-4 font-semibold text-muted-foreground text-right">
                                        {ts?.actions || "Actions"}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                            <p className="text-muted-foreground">
                                                {ts?.noMembers || "No team members yet"}
                                            </p>
                                            <p className="text-sm text-muted-foreground/70 mt-2">
                                                {ts?.addMemberPrompt || "Add your first team member to get started"}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    members.map((member) => (
                                        <tr key={member.id} className="border-b border-border/30 hover:bg-muted/20 transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                        {member.user.name?.charAt(0).toUpperCase() || member.user.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-foreground">
                                                            {member.user.name || "No name"}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {member.acceptedAt 
                                                                ? `${ts?.joined || "Joined"} ${new Date(member.acceptedAt).toLocaleDateString()}`
                                                                : ts?.pending || "Pending invitation"
                                                            }
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Mail className="w-3 h-3 text-muted-foreground" />
                                                        {member.user.email}
                                                    </div>
                                                    {member.user.phone && (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Phone className="w-3 h-3" />
                                                            {member.user.phone}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Popover
                                                    open={hoveredRoleMemberId === member.id}
                                                    onOpenChange={(open) => setHoveredRoleMemberId(open ? member.id : null)}
                                                >
                                                    <div
                                                        className="inline-flex items-center"
                                                        onMouseEnter={() => setHoveredRoleMemberId(member.id)}
                                                        onMouseLeave={() => setHoveredRoleMemberId((cur) => (cur === member.id ? null : cur))}
                                                    >
                                                        <PopoverAnchor asChild>
                                                            <div className="inline-flex items-center cursor-help">
                                                                {member.role === 'OWNER' ? (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn("rounded-full text-xs font-bold border", getRoleBadgeColor(member.role))}
                                                                    >
                                                                        <Shield className="w-3 h-3 mr-1" />
                                                                        {member.role}
                                                                    </Badge>
                                                                ) : (
                                                                    <Select
                                                                        value={member.role}
                                                                        onValueChange={(value) => handleUpdateRole(member.id, value)}
                                                                    >
                                                                        <SelectTrigger className="h-10 w-[160px] rounded-full border border-border bg-background shadow-sm px-4">
                                                                    <SelectValue placeholder={ts?.selectRole || "Select Role"} />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl">
                                                                            <SelectItem value="ADMIN" className="rounded-lg cursor-pointer">
                                                                                Admin
                                                                            </SelectItem>
                                                                            <SelectItem value="MANAGER" className="rounded-lg cursor-pointer">
                                                                                Manager
                                                                            </SelectItem>
                                                                            <SelectItem value="STAFF" className="rounded-lg cursor-pointer">
                                                                                Staff
                                                                            </SelectItem>
                                                                            <SelectItem value="VIEWER" className="rounded-lg cursor-pointer">
                                                                                Viewer
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                )}
                                                            </div>
                                                        </PopoverAnchor>

                                                        <PopoverContent
                                                            align="start"
                                                            side="top"
                                                            sideOffset={10}
                                                            className="w-80 rounded-2xl border-border bg-card shadow-lg"
                                                        >
                                                            <div className="space-y-3">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div>
                                                                        <div className="text-sm font-semibold text-foreground">
                                                                            {ts?.permissionsTitle || "Permissions"}
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            <span className="font-medium">{member.role}</span>
                                                                            {" — "}
                                                                            {getRoleDescription(member.role)}
                                                                        </div>
                                                                    </div>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn("rounded-full text-[11px] font-bold border", getRoleBadgeColor(member.role))}
                                                                    >
                                                                        {member.role}
                                                                    </Badge>
                                                                </div>

                                                                <ul className="space-y-1.5 text-sm text-foreground">
                                                                    {getPermissionLines(member).map((line) => (
                                                                        <li key={line} className="flex items-start gap-2">
                                                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
                                                                            <span className="text-sm text-foreground leading-5">{line}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>

                                                                <div className="text-[11px] text-muted-foreground">
                                                                    {ts?.permissionsNote || "Tip: permissions can be refined per camp site (coming soon)."}
                                                                </div>
                                                            </div>
                                                        </PopoverContent>
                                                    </div>
                                                </Popover>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge
                                                    variant={member.acceptedAt ? "success" : "outline"}
                                                    className={cn(
                                                        "rounded-full text-xs",
                                                        !member.acceptedAt && "text-muted-foreground"
                                                    )}
                                                >
                                                    {member.acceptedAt ? (ts?.active || "Active") : (ts?.invited || "Invited")}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {member.role !== 'OWNER' && (
                                                    <PermissionTooltip
                                                        hasPermission={true}
                                                        title="Remove Member"
                                                        description="This will remove the member from this camp site team."
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setMemberToDelete(member)}
                                                            className="h-9 px-3 rounded-full border-border text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/10 transition shadow-sm"
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-1.5" />
                                                            {ts?.remove || "Remove"}
                                                        </Button>
                                                    </PermissionTooltip>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add Member Dialog */}
            <AddMemberDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                campSiteId={campSiteId}
                onMemberAdded={(member) => {
                    // Defensive: avoid crashing UI if API response is not the expected shape
                    if (!member || !member.user) {
                        console.error("Invalid member payload:", member);
                        toast.error("Failed to add member (invalid response). Please refresh.");
                        return;
                    }
                    setMembers(prev => [member, ...prev].filter(Boolean));
                    setIsAddDialogOpen(false);
                }}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>{ts?.confirmRemove || "Remove team member?"}</AlertDialogTitle>
                        <AlertDialogDescription className="text-left">
                            {ts?.confirmRemoveDesc || "This will remove"} <strong>{memberToDelete?.user.name || memberToDelete?.user.email}</strong> {ts?.fromTeam || "from your team. They will lose access to this camp site."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-full">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDeleteMember}
                            className="rounded-full bg-destructive hover:bg-destructive/90"
                        >
                            {ts?.remove || "Remove"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
