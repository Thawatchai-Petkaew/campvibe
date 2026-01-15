"use client";

import { useEffect, useState, useActionState } from "react";
import { X, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { authenticate } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const { t } = useLanguage();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { status } = useSession();
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined
    );
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [hasSubmitted, setHasSubmitted] = useState(false);
    
    const handleClose = () => {
        setEmail("");
        setPassword("");
        setHasSubmitted(false);
        onClose();
    };

    const inputHeight = "!h-12";
    
    // Check if error is invalid credentials (server error after submit)
    const isInvalidCredentials = errorMessage?.toLowerCase().includes('invalid') || 
                                 errorMessage?.toLowerCase().includes('credentials') ||
                                 errorMessage?.toLowerCase().includes('incorrect');
    
    // Client-side validation error (inline)
    const emailValidationError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? "Please include an '@' in the email address. '" + email + "' is missing an '@'."
        : undefined;

    // If session becomes authenticated, ensure modal/overlay closes even if route doesn't change.
    useEffect(() => {
        if (!isOpen) return;
        if (status !== "authenticated") return;
        handleClose();
        router.refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, status]);

    // Close modal + remove overlay when login succeeds (no error returned)
    useEffect(() => {
        if (!isOpen) return;
        if (!hasSubmitted) return;
        if (isPending) return;
        if (errorMessage) return;

        // Success: close modal and refresh the page so Navbar gets the new session/currentUser.
        handleClose();
        router.refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, hasSubmitted, isPending, errorMessage]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent showCloseButton={false} className="sm:max-w-md rounded-[24px] p-0 overflow-hidden border-none shadow-2xl bg-card">
                <div className="flex flex-col relative">
                    {/* Header */}
                    <div className="flex items-center justify-center p-6 border-b border-border/60">
                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-4 top-4 rounded-full hover:bg-muted transition-colors w-10 h-10"
                                onClick={handleClose}
                            >
                                <X className="w-5 h-5 text-foreground" />
                            </Button>
                        </DialogClose>
                        <DialogTitle className="text-lg font-bold text-foreground">{t.auth.login}</DialogTitle>
                    </div>

                    {/* Content */}
                    <div className="p-8 space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-foreground">{t.auth.welcomeBack}</h2>
                            <p className="text-sm text-muted-foreground">{t.auth.loginToContinue}</p>
                        </div>

                        <form 
                            noValidate
                            action={async (formData: FormData) => {
                                setHasSubmitted(true);
                                // Override with controlled input values
                                formData.set('email', email);
                                formData.set('password', password);
                                // Stay in Camper view after login (unless user explicitly navigated to /login?callbackUrl=...)
                                // For modal login, redirect back to the current page.
                                const redirectTo = `${pathname || "/"}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
                                formData.set('redirectTo', redirectTo);
                                await formAction(formData);
                                // NOTE: success/close handled by effect above. Keep hasSubmitted true to show error banner if needed.
                            }} 
                            className="space-y-4"
                        >

                            {/* Server Error Banner (after submit) */}
                            {hasSubmitted && isInvalidCredentials && (
                                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{t.auth.invalidCredentials || "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองอีกครั้ง"}</span>
                                </div>
                            )}

                            <InputField
                                label={t.auth.email}
                                id="email"
                                name="email"
                                type="text"
                                placeholder="email@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                error={emailValidationError}
                                leftIcon={<Mail className="w-4 h-4" />}
                                className={cn("rounded-full bg-background border-border focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                            />

                            <InputField
                                label={t.auth.password}
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                leftIcon={<Lock className="w-4 h-4" />}
                                rightIcon={
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center w-8 h-8"
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                }
                                containerClassName="mb-8"
                                className={cn("rounded-full bg-background border-border focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                            />


                            <Button
                                type="submit"
                                disabled={isPending}
                                className="w-full bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all !h-12 text-lg"
                            >
                                {isPending ? t.auth.signingIn : t.auth.login}
                            </Button>
                        </form>

                        <div className="pt-4 border-t border-border/60 text-center">
                            <p className="text-sm text-muted-foreground">
                                {t.auth.dontHaveAccount}{" "}
                                <a href="/register" className="text-primary font-bold hover:underline">
                                    {t.auth.register}
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
