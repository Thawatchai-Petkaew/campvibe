'use client';

import { useActionState } from 'react';
import { authenticate } from '@/lib/actions';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined
    );

    const inputHeight = "!h-12";

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
                            {t.auth.welcomeBack}
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                            {t.auth.loginToContinue}
                        </p>
                    </div>

                    {/* Form */}
                    <form action={formAction} className="space-y-4">
                        <input type="hidden" name="redirectTo" value={callbackUrl} />

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
                                    autoComplete="email"
                                    required
                                    className={cn("rounded-full bg-white border-gray-200 pl-12 focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                                />
                            </div>
                        </div>

                        {/* Password */}
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
                                    autoComplete="current-password"
                                    required
                                    className={cn("rounded-full bg-white border-gray-200 pl-12 focus-visible:ring-primary/30 focus-visible:border-primary", inputHeight)}
                                />
                            </div>
                        </div>

                        {/* Error Message */}
                        {errorMessage && (
                            <p className="text-sm text-red-500 px-4">{errorMessage}</p>
                        )}

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
                    <div className="pt-4 border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-500">
                            {t.auth.dontHaveAccount}{" "}
                            <Link href="/register" className="text-primary font-bold hover:underline">
                                {t.auth.register}
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
