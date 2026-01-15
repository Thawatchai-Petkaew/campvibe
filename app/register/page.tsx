'use client';

import { useActionState, useState, useEffect } from 'react';
import { register } from '@/lib/actions';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { InputField } from '@/components/ui/input-field';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Lock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
    const { t } = useLanguage();
    const router = useRouter();
    const [errorMessage, formAction, isPending] = useActionState(
        register,
        undefined
    );

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [consentRequired, setConsentRequired] = useState(false);
    const [consentMarketing, setConsentMarketing] = useState(false);
    const [validationError, setValidationError] = useState("");
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    
    // Client-side validation errors (inline)
    const emailValidationError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? "Please include an '@' in the email address. '" + email + "' is missing an '@'."
        : undefined;
    
    // Server error (banner) - only show after submit
    const serverError = hasSubmitted && errorMessage ? errorMessage : undefined;

    const inputHeight = "!h-12";

    // Handle successful registration
    useEffect(() => {
        if (formSubmitted && !errorMessage && !isPending) {
            // Registration was successful
            toast.success(t.auth.registerModal.registrationSuccess);
            setFormSubmitted(false);
            router.push('/login');
        }
    }, [errorMessage, isPending, formSubmitted, router, t]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        setValidationError("");
        setHasSubmitted(true);

        if (!consentRequired) {
            e.preventDefault();
            setValidationError(t.auth.registerModal.errorConsent);
            setHasSubmitted(false);
            return;
        }

        if (password !== confirmPassword) {
            e.preventDefault();
            setValidationError(t.auth.registerModal.errorPasswordMismatch);
            setHasSubmitted(false);
            return;
        }

        // Mark form as submitted to track success
        setFormSubmitted(true);
    };

    const parseConsentText = (text: string) => {
        const parts = text.split(/\[([^\]]+)\]/);
        return parts.map((part, index) => {
            if (index % 2 === 1) {
                const href = part === "Terms of Service" || part === "ข้อกำหนดการให้บริการ"
                    ? "/terms"
                    : "/privacy";
                return (
                    <a
                        key={index}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-bold hover:underline"
                    >
                        {part}
                    </a>
                );
            }
            return part;
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
                <div className="bg-card rounded-[24px] shadow-2xl p-8 space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-foreground">
                            {t.auth.registerModal.title}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t.auth.registerModal.subtitle}
                        </p>
                    </div>

                    {/* Form */}
                    <form noValidate action={formAction} onSubmit={handleSubmit} className="space-y-4">
                        <input type="hidden" name="marketingConsent" value={consentMarketing ? "true" : "false"} />

                        {/* Server Error Banner (after submit) */}
                        <ErrorBanner message={serverError || ""} />

                        {/* Full Name */}
                        <InputField
                            label={t.auth.registerModal.fullName}
                            id="name"
                            name="name"
                            type="text"
                            placeholder={t.auth.registerModal.fullNamePlaceholder}
                            required
                            leftIcon={<User className="w-4 h-4" />}
                            className={cn("rounded-full bg-background border-border focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                        />

                        {/* Email */}
                        <InputField
                            label={t.auth.email}
                            id="email"
                            name="email"
                            type="text"
                            placeholder={t.auth.registerModal.emailPlaceholder}
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
                            placeholder={t.auth.registerModal.passwordPlaceholder}
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={validationError && validationError.includes('password') ? validationError : undefined}
                            hint={password && password.length > 0 && password.length < 6 ? "Password must be at least 6 characters" : undefined}
                            leftIcon={<Lock className="w-4 h-4" />}
                            className={cn("rounded-full bg-background border-border focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                        />

                        {/* Confirm Password */}
                        <InputField
                            label={t.auth.registerModal.confirmPassword}
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            placeholder={t.auth.registerModal.confirmPasswordPlaceholder}
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            error={validationError && validationError.includes('password') ? validationError : undefined}
                            leftIcon={<Lock className="w-4 h-4" />}
                            className={cn("rounded-full bg-background border-border focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                        />

                        {/* Consent Checkboxes */}
                        <div className="space-y-3 pt-2">
                            {/* Required Consent */}
                            <div className="flex items-start space-x-3">
                                <Checkbox
                                    id="consentRequired"
                                    checked={consentRequired}
                                    onCheckedChange={(checked) => setConsentRequired(checked as boolean)}
                                    className="mt-0.5"
                                />
                                <label
                                    htmlFor="consentRequired"
                                    className="text-sm leading-relaxed cursor-pointer"
                                >
                                    {parseConsentText(t.auth.registerModal.consentRequired)}
                                </label>
                            </div>

                            {/* Optional Marketing Consent */}
                            <div className="flex items-start space-x-3">
                                <Checkbox
                                    id="consentMarketing"
                                    checked={consentMarketing}
                                    onCheckedChange={(checked) => setConsentMarketing(checked as boolean)}
                                    className="mt-0.5"
                                />
                                <label
                                    htmlFor="consentMarketing"
                                    className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                                >
                                    {t.auth.registerModal.consentMarketing}
                                </label>
                            </div>
                        </div>


                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={isPending || !consentRequired}
                            className="w-full bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all !h-12 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPending ? t.auth.registerModal.registering : t.auth.registerModal.registerButton}
                        </Button>
                    </form>

                    {/* Footer */}
                    <div className="pt-4 border-t border-border/60 text-center">
                        <p className="text-sm text-muted-foreground">
                            {t.auth.registerModal.alreadyHaveAccount}{" "}
                            <Link href="/login" className="text-primary font-bold hover:underline">
                                {t.auth.registerModal.signIn}
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
