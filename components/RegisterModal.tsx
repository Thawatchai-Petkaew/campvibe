"use client";

import { useState, useActionState, useEffect } from "react";
import { X, Mail, Lock, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { register } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";

interface RegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function RegisterModal({ isOpen, onClose, onSuccess }: RegisterModalProps) {
    const { t } = useLanguage();
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

    // Handle successful registration
    useEffect(() => {
        if (formSubmitted && !errorMessage && !isPending) {
            // Registration was successful
            toast.success(t.auth.registerModal.registrationSuccess);
            setFormSubmitted(false);

            // Reset form
            setPassword("");
            setConfirmPassword("");
            setConsentRequired(false);
            setConsentMarketing(false);
            setValidationError("");

            // Switch to login modal
            if (onSuccess) {
                onSuccess();
            }
        }
    }, [errorMessage, isPending, formSubmitted, onSuccess, t]);

    const inputHeight = "!h-12";

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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="sm:max-w-md rounded-[24px] p-0 overflow-hidden border-none shadow-2xl bg-white">
                <div className="flex flex-col relative">
                    {/* Header */}
                    <div className="flex items-center justify-center p-6 border-b border-gray-100">
                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-4 top-4 rounded-full hover:bg-gray-100 transition-colors w-10 h-10"
                                onClick={onClose}
                            >
                                <X className="w-5 h-5 text-gray-900" />
                            </Button>
                        </DialogClose>
                        <div className="text-center">
                            <DialogTitle className="text-lg font-bold">{t.auth.registerModal.title}</DialogTitle>
                            <p className="text-sm text-gray-500 mt-1">{t.auth.registerModal.subtitle}</p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 space-y-4">
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
                                <button
                                    onClick={onClose}
                                    className="text-primary font-bold hover:underline"
                                >
                                    {t.auth.registerModal.signIn}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
