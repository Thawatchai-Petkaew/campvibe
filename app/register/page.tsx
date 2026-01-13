'use client';

import { useActionState, useState, useEffect } from 'react';
import { register } from '@/lib/actions';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [consentRequired, setConsentRequired] = useState(false);
    const [consentMarketing, setConsentMarketing] = useState(false);
    const [validationError, setValidationError] = useState("");
    const [formSubmitted, setFormSubmitted] = useState(false);

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

        if (!consentRequired) {
            e.preventDefault();
            setValidationError(t.auth.registerModal.errorConsent);
            return;
        }

        if (password !== confirmPassword) {
            e.preventDefault();
            setValidationError(t.auth.registerModal.errorPasswordMismatch);
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
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
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
                <div className="bg-white rounded-[24px] shadow-2xl p-8 space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {t.auth.registerModal.title}
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                            {t.auth.registerModal.subtitle}
                        </p>
                    </div>

                    {/* Form */}
                    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
                        <input type="hidden" name="marketingConsent" value={consentMarketing ? "true" : "false"} />

                        {/* Full Name */}
                        <div className="space-y-2">
                            <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">
                                {t.auth.registerModal.fullName}
                            </label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="name"
                                    name="name"
                                    type="text"
                                    placeholder={t.auth.registerModal.fullNamePlaceholder}
                                    required
                                    className={cn("rounded-full bg-white border-gray-200 pl-12 focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">
                                {t.auth.email}
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder={t.auth.registerModal.emailPlaceholder}
                                    required
                                    className={cn("rounded-full bg-white border-gray-200 pl-12 focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">
                                {t.auth.password}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder={t.auth.registerModal.passwordPlaceholder}
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={cn("rounded-full bg-white border-gray-200 pl-12 focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                                />
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">
                                {t.auth.registerModal.confirmPassword}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder={t.auth.registerModal.confirmPasswordPlaceholder}
                                    required
                                    minLength={6}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={cn("rounded-full bg-white border-gray-200 pl-12 focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                                />
                            </div>
                        </div>

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
                                    className="text-sm text-gray-600 leading-relaxed cursor-pointer"
                                >
                                    {t.auth.registerModal.consentMarketing}
                                </label>
                            </div>
                        </div>

                        {/* Error Messages */}
                        {(validationError || errorMessage) && (
                            <p className="text-sm text-red-500 px-4">{validationError || errorMessage}</p>
                        )}

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
                    <div className="pt-4 border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-500">
                            {t.auth.registerModal.alreadyHaveAccount}{" "}
                            <Link href="/login" className="text-primary font-bold hover:underline">
                                {t.auth.registerModal.signIn}
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Back to Home */}
                <div className="mt-6 text-center">
                    <Link href="/" className="text-sm text-gray-600 hover:text-primary transition-colors">
                        ← Back to home
                    </Link>
                </div>
            </div>
        </div>
    );
}
