"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Mail, Phone, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AddMemberDialogProps {
    isOpen: boolean;
    onClose: () => void;
    campSiteId: string;
    onMemberAdded: (member: any) => void;
}

export function AddMemberDialog({ isOpen, onClose, campSiteId, onMemberAdded }: AddMemberDialogProps) {
    const { t } = useLanguage();
    const [method, setMethod] = useState<'email' | 'phone'>('email');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState('VIEWER');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/team/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campSiteId,
                    email: method === 'email' ? email : undefined,
                    phone: method === 'phone' ? phone : undefined,
                    role
                })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(t.settings?.memberAdded || "Team member added successfully");
                // apiSuccess() returns the created member directly (not wrapped)
                onMemberAdded(data);
                handleClose();
            } else {
                toast.error(data.error || "Failed to add member");
            }
        } catch (error) {
            console.error("Add member error:", error);
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setEmail('');
        setPhone('');
        setRole('VIEWER');
        setMethod('email');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="rounded-2xl max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-left">
                        {t.settings?.addTeamMember || "Add Team Member"}
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        {t.settings?.addMemberDesc || "Invite a team member to help manage your camp site"}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Contact Method Tabs */}
                    <Tabs value={method} onValueChange={(v) => setMethod(v as 'email' | 'phone')}>
                        <TabsList className="grid w-full grid-cols-2 rounded-full p-1">
                            <TabsTrigger value="email" className="rounded-full data-[state=active]:shadow-sm">
                                <Mail className="w-4 h-4 mr-2" />
                                {t.settings?.email || "Email"}
                            </TabsTrigger>
                            <TabsTrigger value="phone" className="rounded-full data-[state=active]:shadow-sm">
                                <Phone className="w-4 h-4 mr-2" />
                                {t.settings?.phone || "Phone"}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="email" className="mt-6">
                            <InputField
                                type="email"
                                label={t.settings?.emailAddress || "Email Address"}
                                placeholder="member@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="rounded-full"
                            />
                        </TabsContent>

                        <TabsContent value="phone" className="mt-6">
                            <InputField
                                type="tel"
                                label={t.settings?.phoneNumber || "Phone Number"}
                                placeholder="0812345678"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                className="rounded-full"
                            />
                        </TabsContent>
                    </Tabs>

                    {/* Role Selection */}
                    <div className="space-y-2">
                        <Label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">
                            {t.settings?.selectRole || "Select Role"}
                        </Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger className="h-12 rounded-full border-border shadow-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl min-w-[400px]">
                                <SelectItem value="ADMIN" className="rounded-full cursor-pointer my-1 h-auto py-3">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                        <span className="font-medium">Admin</span>
                                        <span className="text-xs text-muted-foreground">
                                            {t.settings?.adminDesc || "Full access except owner privileges"}
                                        </span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="MANAGER" className="rounded-full cursor-pointer my-1 h-auto py-3">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                        <span className="font-medium">Manager</span>
                                        <span className="text-xs text-muted-foreground">
                                            {t.settings?.managerDesc || "Manage bookings and view analytics"}
                                        </span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="STAFF" className="rounded-full cursor-pointer my-1 h-auto py-3">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                        <span className="font-medium">Staff</span>
                                        <span className="text-xs text-muted-foreground">
                                            {t.settings?.staffDesc || "View and update bookings only"}
                                        </span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="VIEWER" className="rounded-full cursor-pointer my-1 h-auto py-3">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                        <span className="font-medium">Viewer</span>
                                        <span className="text-xs text-muted-foreground">
                                            {t.settings?.viewerDesc || "Read-only access"}
                                        </span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter className="gap-3 sm:gap-3 mt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            className="rounded-full flex-1 sm:flex-initial"
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="rounded-full bg-primary hover:bg-primary/90 flex-1 sm:flex-initial"
                            disabled={loading}
                        >
                            {loading ? (
                                <>Loading...</>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    {t.settings?.addMember || "Add Member"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
