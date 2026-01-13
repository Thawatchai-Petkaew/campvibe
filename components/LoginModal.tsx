"use client";

import { useState, useActionState } from "react";
import { X, Mail, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { authenticate } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined
    );

    const inputHeight = "!h-12";

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
                        <DialogTitle className="text-lg font-bold">{t.auth.login}</DialogTitle>
                    </div>

                    {/* Content */}
                    <div className="p-8 space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-gray-900">{t.auth.welcomeBack}</h2>
                            <p className="text-gray-500 text-sm">{t.auth.loginToContinue}</p>
                        </div>

                        <form action={formAction} className="space-y-4 ">
                            <input type="hidden" name="redirectTo" value="/dashboard" />

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
                                        placeholder="email@example.com"
                                        required
                                        className={cn("rounded-full bg-white border-gray-200 pl-12 focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 mb-8">
                                <label className="text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4">
                                    {t.auth.password}
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="••••••••"
                                        required
                                        className={cn("rounded-full bg-white border-gray-200 pl-12 focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                                    />
                                </div>
                            </div>

                            {errorMessage && (
                                <p className="text-sm text-red-500 px-4">{errorMessage}</p>
                            )}

                            <Button
                                type="submit"
                                disabled={isPending}
                                className="w-full bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all !h-12 text-lg"
                            >
                                {isPending ? t.auth.signingIn : t.auth.login}
                            </Button>
                        </form>

                        <div className="pt-4 border-t border-gray-100 text-center">
                            <p className="text-sm text-gray-500">
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
