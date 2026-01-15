'use client';

import { useActionState, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { authenticate } from '@/lib/actions';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { InputField } from '@/components/ui/input-field';
import { Mail, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    // Default: stay in Camper view after login
    const callbackUrl = searchParams.get('callbackUrl') || '/';
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined
    );
    const [email, setEmail] = useState("");
    const [hasSubmitted, setHasSubmitted] = useState(false);

    const inputHeight = "!h-12";
    
    // Check if error is invalid credentials (server error after submit)
    const isInvalidCredentials = errorMessage?.toLowerCase().includes('invalid') || 
                                 errorMessage?.toLowerCase().includes('credentials') ||
                                 errorMessage?.toLowerCase().includes('incorrect');
    
    // Client-side validation error (inline)
    const emailValidationError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? "Please include an '@' in the email address. '" + email + "' is missing an '@'."
        : undefined;

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
                <div className="bg-card rounded-[24px] shadow-2xl p-8 space-y-6">
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
                        action={async (formData: FormData) => {
                            setHasSubmitted(true);
                            formData.set('email', email);
                            formData.set('redirectTo', callbackUrl);
                            await formAction(formData);
                            setHasSubmitted(false);
                        }} 
                        className="space-y-4"
                    >
                        <input type="hidden" name="redirectTo" value={callbackUrl} />

                        {/* Server Error Banner (after submit) */}
                        {hasSubmitted && isInvalidCredentials && (
                            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{errorMessage || t.auth.invalidCredentials || "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองอีกครั้ง"}</span>
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
                            className={cn("rounded-full bg-background border-border focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                        />

                        {/* Password */}
                        <InputField
                            label={t.auth.password}
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            leftIcon={<Lock className="w-4 h-4" />}
                            containerClassName="mb-8"
                            className={cn("rounded-full bg-background border-border focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                        />

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all !h-12 text-lg"
                        >
                            {isPending ? t.auth.signingIn : t.auth.login}
                        </Button>
                    </form>

                    {/* Footer */}
                    <div className="pt-4 border-t border-border/60 text-center">
                        <p className="text-sm text-muted-foreground">
                            {t.auth.dontHaveAccount}{" "}
                            <Link href="/register" className="text-primary font-bold hover:underline">
                                {t.auth.register}
                            </Link>
                        </p>
                    </div>
                </div>

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
