'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { InputField } from '@/components/ui/input-field';
import { ErrorBanner } from '@/components/ui/error-banner';
import { User, Mail, Phone, Camera, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';

interface UserProfile {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
    role: string;
    createdAt: string;
}

export default function ProfilePage() {
    const { t } = useLanguage();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    
    // Client-side validation errors (inline)
    const emailValidationError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? "Please include an '@' in the email address. '" + email + "' is missing an '@'."
        : undefined;

    // Fetch profile on mount
    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/user/profile');
            if (res.status === 401) {
                router.push('/login?callbackUrl=/profile');
                return;
            }
            if (!res.ok) throw new Error('Failed to fetch profile');

            const data = await res.json();
            setProfile(data);
            setName(data.name || '');
            setEmail(data.email || '');
            setPhone(data.phone || '');
            setImage(data.image);
        } catch (error) {
            toast.error('Failed to load profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`/api/upload?filename=profile-${Date.now()}`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const data = await res.json();
            const imageUrl = data.url || data.downloadUrl;
            setImage(imageUrl);

            // Auto-save image
            await saveProfile({ image: imageUrl });
            toast.success('Profile image updated');
        } catch (error) {
            toast.error('Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    const saveProfile = async (updates?: Partial<{ name: string; email: string; phone: string; image: string | null }>) => {
        setIsSaving(true);
        setServerError(null);
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates || { name, email, phone, image }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to update profile');
            }

            const data = await res.json();
            setProfile(data);
            if (!updates) {
                toast.success(t.profile?.saved || 'Profile saved successfully');
                setHasSubmitted(false);
            }
        } catch (error: any) {
            setServerError(error.message || 'Failed to save profile');
            setHasSubmitted(true);
            if (!updates) {
                toast.error(error.message || 'Failed to save profile');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setHasSubmitted(true);
        saveProfile();
    };

    if (isLoading) {
        return <LoadingSpinner fullScreen />;
    }

    return (
        <div className="min-h-screen bg-background py-12 px-4">
            <div className="max-w-xl mx-auto">
                {/* Back Button */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t.dashboard?.backToHome || 'Back to home'}</span>
                </Link>

                {/* Profile Card */}
                <div className="bg-card rounded-[24px] shadow-2xl p-8 space-y-8">
                    {/* Header */}
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-foreground">
                            {t.profile?.title || 'My Profile'}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t.profile?.subtitle || 'Manage your account information'}
                        </p>
                    </div>

                    {/* Profile Image */}
                    <div className="flex justify-center">
                        <div className="relative group">
                            <div
                                className={cn(
                                    "w-32 h-32 rounded-full overflow-hidden bg-muted border-4 border-background shadow-lg",
                                    "ring-4 ring-primary/10 transition-all",
                                    isUploading && "opacity-50"
                                )}
                            >
                                {(image && !imageError) ? (
                                    <img
                                        src={image}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                        onError={() => setImageError(true)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/30">
                                        <User className="w-16 h-16 text-primary/60" />
                                    </div>
                                )}
                            </div>

                            {/* Upload Overlay */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className={cn(
                                    "absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100",
                                    "flex items-center justify-center transition-opacity cursor-pointer",
                                    isUploading && "opacity-100"
                                )}
                            >
                                {isUploading ? (
                                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                                ) : (
                                    <Camera className="w-8 h-8 text-white" />
                                )}
                            </button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Edit Form */}
                    <form noValidate onSubmit={handleSubmit} className="space-y-5">
                        {/* Server Error Banner (after submit) */}
                        {hasSubmitted && serverError && (
                            <ErrorBanner message={serverError} />
                        )}

                        {/* Name */}
                        <InputField
                            label={t.profile?.name || 'Full Name'}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t.profile?.namePlaceholder || 'Enter your name'}
                            leftIcon={<User className="w-4 h-4" />}
                            className="rounded-full bg-background border-border h-12 focus-visible:ring-primary/30 focus-visible:border-primary"
                        />

                        {/* Email */}
                        <InputField
                            label={t.auth?.email || 'Email'}
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t.profile?.emailPlaceholder || 'Enter your email'}
                            error={emailValidationError}
                            leftIcon={<Mail className="w-4 h-4" />}
                            className="rounded-full bg-background border-border h-12 focus-visible:ring-primary/30 focus-visible:border-primary"
                        />

                        {/* Phone */}
                        <InputField
                            label={t.profile?.phone || 'Phone Number'}
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder={t.profile?.phonePlaceholder || 'Enter your phone number'}
                            leftIcon={<Phone className="w-4 h-4" />}
                            className="rounded-full bg-background border-border h-12 focus-visible:ring-primary/30 focus-visible:border-primary"
                        />

                        {/* Role Badge */}
                        <div className="flex justify-center pt-2">
                            <span className={cn(
                                "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider",
                                profile?.role === 'ADMIN' && "bg-red-100 text-red-700",
                                profile?.role === 'OPERATOR' && "bg-blue-100 text-blue-700",
                                profile?.role === 'CAMPER' && "bg-green-100 text-green-700"
                            )}>
                                {profile?.role || 'CAMPER'}
                            </span>
                        </div>

                        {/* Save Button */}
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="w-full bg-primary hover:bg-primary/90 text-white rounded-full font-bold h-12 text-lg shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        >
                            {isSaving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Check className="w-5 h-5 mr-2" />
                                    {t.profile?.save || 'Save Changes'}
                                </>
                            )}
                        </Button>
                    </form>
                </div>

                {/* Member Since */}
                {profile?.createdAt && (
                    <p className="text-center text-sm text-muted-foreground mt-6">
                        {t.profile?.memberSince || 'Member since'}{' '}
                        {new Date(profile.createdAt).toLocaleDateString()}
                    </p>
                )}
            </div>
        </div>
    );
}
