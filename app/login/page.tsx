'use client';

import { useState, useTransition } from 'react';
import { AlertCircle } from 'lucide-react';
import { googleSignIn } from '@/lib/actions';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { InputField } from '@/components/ui/input-field';
import { Card } from '@/components/ui/card';
import { Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/**
 * Validates that `raw` is a safe same-origin path (SEC-A open-redirect guard, CWE-601):
 *   - must be a string starting with a single "/"
 *   - must NOT start with "//" (protocol-relative)
 *   - must NOT start with "/\" (backslash trick)
 *   - must contain no control chars (charCode < 0x20)
 * Falls back to "/" on any violation.
 */
function sanitizeCallbackUrl(raw: string | null | undefined): string {
    return typeof raw === "string" &&
        raw.startsWith("/") &&
        !raw.startsWith("//") &&
        !raw.startsWith("/\\") &&
        ![...raw].some((ch) => ch.charCodeAt(0) < 0x20)
        ? raw
        : "/";
}

export default function LoginPage() {
    const { t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    // Default: stay in Camper view after login. Guard against open-redirect.
    const callbackUrl = sanitizeCallbackUrl(searchParams.get('callbackUrl'));
    const [isPending, startTransition] = useTransition();
    const [isGooglePending, startGoogleTransition] = useTransition();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    // Client-side validation error (inline)
    const emailValidationError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? "Please include an '@' in the email address. '" + email + "' is missing an '@'."
        : undefined;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (emailValidationError) return;
        startTransition(async () => {
            setErrorMessage(undefined);
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });
            if (result?.error) {
                setErrorMessage(t.auth.invalidCredentials || "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองอีกครั้ง");
                return;
            }
            // Success: navigate to the (validated) callbackUrl and refresh server state.
            router.push(callbackUrl);
            router.refresh();
        });
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <Link href="/">
                        <Image
                            src="/logo.png"
                            alt="CampVibe"
                            width={200}
                            height={60}
                            className="h-12 w-auto"
                        />
                    </Link>
                </div>

                {/* Card */}
                <Card className="p-8 shadow-2xl space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-foreground">
                            {t.auth.welcomeBack}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t.auth.loginToContinue}
                        </p>
                    </div>

                    {/* Form */}
                    <form
                        noValidate
                        onSubmit={handleSubmit}
                        className="space-y-4"
                    >
                        {/* Error Banner (bad credentials) */}
                        {errorMessage && (
                            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {/* Email */}
                        <InputField
                            label={t.auth.email}
                            id="email"
                            name="email"
                            type="text"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            error={emailValidationError}
                            leftIcon={<Mail className="w-4 h-4" />}
                            inputSize="lg"
                            className="rounded-full bg-background border-border"
                        />

                        {/* Password */}
                        <InputField
                            label={t.auth.password}
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            leftIcon={<Lock className="w-4 h-4" />}
                            containerClassName="mb-8"
                            inputSize="lg"
                            className="rounded-full bg-background border-border"
                        />

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            size="lg"
                            disabled={isPending}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all text-lg"
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
                            startGoogleTransition(() => googleSignIn(callbackUrl));
                        }}
                    >
                        <GoogleIcon aria-hidden />
                        <span>
                            {isGooglePending
                                ? (t.auth.signingInWithGoogle ?? t.auth.signingIn)
                                : t.auth.signInWithGoogle}
                        </span>
                    </Button>

                    {/* Footer — /register 404s; direct to home where the register modal is accessible */}
                    <div className="pt-4 border-t border-border/60 text-center">
                        <p className="text-sm text-muted-foreground">
                            {t.auth.dontHaveAccount}{" "}
                            <Link href="/" className="text-primary font-bold hover:underline">
                                {t.auth.register}
                            </Link>
                        </p>
                    </div>
                </Card>

                {/* Back to Home */}
                <div className="mt-6 text-center">
                    <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        ← Back to home
                    </Link>
                </div>
            </div>
        </div>
    );
}
