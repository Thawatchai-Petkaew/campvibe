"use client";

import { useEffect, useState, useActionState, useTransition } from "react";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { authenticate, googleSignIn } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Dialog } from "@/components/ui/dialog";
import { ModalContent, ModalHeader } from "@/components/ui/modal-shell";
import { GoogleIcon } from "@/components/icons/GoogleIcon";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Optional subtitle shown below the welcome heading — e.g. wishlist login prompt. */
    subtitle?: string;
}

export function LoginModal({ isOpen, onClose, subtitle }: LoginModalProps) {
    const { t } = useLanguage();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { status } = useSession();
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined
    );
    const [isGooglePending, startGoogleTransition] = useTransition();
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
            <ModalContent className="sm:max-w-md" aria-describedby={undefined}>
                <div className="flex flex-col relative">
                    <ModalHeader
                        title={t.auth.login}
                        closeLabel={t.common?.close}
                        onClose={handleClose}
                    />

                    {/* Content */}
                    <div className="p-8 space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-foreground">{t.auth.welcomeBack}</h2>
                            <p className="text-sm text-muted-foreground">
                                {subtitle ?? t.auth.loginToContinue}
                            </p>
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
                                inputSize="lg"
                                className="rounded-full bg-background border-border"
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
                                inputSize="lg"
                                className="rounded-full bg-background border-border"
                            />


                            <Button
                                type="submit"
                                size="lg"
                                disabled={isPending}
                                className="w-full bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 text-lg"
                            >
                                {isPending ? t.auth.signingIn : t.auth.login}
                            </Button>
                        </form>

                        {/* Divider + Google sign-in */}
                        <div className="relative flex items-center gap-4">
                            <div className="flex-1 border-t border-border/60" />
                            <span className="text-xs text-muted-foreground select-none">
                                {t.common?.or ?? "or"}
                            </span>
                            <div className="flex-1 border-t border-border/60" />
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            disabled={isGooglePending || isPending}
                            data-testid="btn--login-google"
                            aria-label={t.auth.signInWithGoogle}
                            className="w-full rounded-full flex items-center justify-center gap-3"
                            onClick={() => {
                                const redirectTo = `${pathname || "/"}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
                                startGoogleTransition(() => googleSignIn(redirectTo));
                            }}
                        >
                            <GoogleIcon aria-hidden />
                            <span>
                                {isGooglePending
                                    ? (t.auth.signingInWithGoogle ?? t.auth.signingIn)
                                    : t.auth.signInWithGoogle}
                            </span>
                        </Button>

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
            </ModalContent>
        </Dialog>
    );
}
