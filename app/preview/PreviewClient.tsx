"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { FilterChip } from "@/components/ui/filter-chip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import {
    Heart,
    Star,
    Search,
    Bell,
    User,
    Settings,
    MapPin,
    Calendar,
    Image,
    Menu,
    Check,
    X,
    Tent,
    Mountain,
    Waves,
} from "lucide-react";

// Token color swatches to display in the Colors section
const COLOR_SWATCHES: { label: string; bg: string; text: string }[] = [
    { label: "background", bg: "bg-background", text: "text-foreground" },
    { label: "card", bg: "bg-card", text: "text-card-foreground" },
    { label: "muted", bg: "bg-muted", text: "text-muted-foreground" },
    { label: "primary", bg: "bg-primary", text: "text-primary-foreground" },
    { label: "secondary", bg: "bg-secondary", text: "text-secondary-foreground" },
    { label: "accent", bg: "bg-accent", text: "text-accent-foreground" },
    { label: "destructive", bg: "bg-destructive", text: "text-primary-foreground" },
    { label: "success", bg: "bg-success", text: "text-success-foreground" },
    { label: "ring", bg: "bg-ring", text: "text-foreground" },
];

function SectionDivider() {
    return <hr className="border-border my-8" />;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="font-display text-xl font-semibold text-foreground mb-6">
            {children}
        </h2>
    );
}

export function PreviewClient() {
    const { t } = useLanguage();

    // FilterChip state for preview
    const [pillSelected, setPillSelected] = useState<string[]>([]);
    const [cardSelected, setCardSelected] = useState<string[]>([]);
    const [iconCardSelected, setIconCardSelected] = useState<string[]>([]);
    const [commandOpen, setCommandOpen] = useState(false);

    const togglePill = (id: string) =>
        setPillSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    const toggleCard = (id: string) =>
        setCardSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    const toggleIconCard = (id: string) =>
        setIconCardSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Sticky top bar with ThemeToggle */}
            <div className="sticky top-0 z-40 bg-card border-b border-border px-6 py-3 flex items-center justify-between">
                <span className="font-display font-semibold text-foreground">
                    {t.preview.title}
                </span>
                <ThemeToggle />
            </div>

            <main className="container mx-auto px-6 py-10 max-w-3xl">
                {/* ── Colors ── */}
                <SectionHeading>{t.preview.colorsSection}</SectionHeading>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                    {COLOR_SWATCHES.map(({ label, bg, text }) => (
                        <div key={label} className="flex flex-col gap-1">
                            <div
                                className={`${bg} ${text} rounded-xl h-14 flex items-center justify-center border border-border`}
                                aria-label={label}
                            />
                            <span className="text-xs text-muted-foreground text-center leading-tight">
                                {label}
                            </span>
                        </div>
                    ))}
                </div>

                <SectionDivider />

                {/* ── Typography ── */}
                <SectionHeading>{t.preview.typographySection}</SectionHeading>
                <div className="space-y-4">
                    <h1 className="font-display text-4xl font-bold text-foreground">
                        Heading 1 — Outfit
                    </h1>
                    <h2 className="font-display text-3xl font-semibold text-foreground">
                        Heading 2 — Outfit
                    </h2>
                    <h3 className="font-display text-2xl font-medium text-foreground">
                        Heading 3 — Outfit
                    </h3>
                    <h4 className="font-display text-xl font-medium text-foreground">
                        Heading 4 — Outfit
                    </h4>
                    <p className="text-base text-foreground">
                        Body text — Inter. The quick brown fox jumps over the lazy dog.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Muted / secondary text — Inter. Used for captions, placeholders, and supporting copy.
                    </p>
                </div>

                <SectionDivider />

                {/* ── Buttons ── */}
                <SectionHeading>{t.preview.buttonsSection}</SectionHeading>
                <div className="flex flex-wrap gap-3">
                    <Button variant="default">Default</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="link">Link</Button>
                    <Button variant="default" disabled>Disabled</Button>
                </div>

                <SectionDivider />

                {/* ── Forms ── */}
                <SectionHeading>{t.preview.formsSection}</SectionHeading>
                <form noValidate className="space-y-4 max-w-sm">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground" htmlFor="preview-input-default">
                            Default input
                        </label>
                        <Input
                            id="preview-input-default"
                            placeholder="Placeholder text"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground" htmlFor="preview-input-error">
                            Error input
                        </label>
                        <Input
                            id="preview-input-error"
                            aria-invalid
                            defaultValue="Invalid value"
                        />
                        <p className="text-xs text-destructive">This field has an error.</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground" htmlFor="preview-input-disabled">
                            Disabled input
                        </label>
                        <Input
                            id="preview-input-disabled"
                            disabled
                            placeholder="Disabled"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground" htmlFor="preview-textarea">
                            Textarea
                        </label>
                        <Textarea
                            id="preview-textarea"
                            placeholder="Enter a longer message..."
                        />
                    </div>
                    <ErrorBanner message="Something went wrong. Please try again." />
                </form>

                <SectionDivider />

                {/* ── Badges ── */}
                <SectionHeading>{t.preview.badgesSection}</SectionHeading>
                <div className="flex flex-wrap gap-2 mb-8">
                    <Badge variant="default">Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                    <Badge variant="success">Success</Badge>
                    <Badge variant="muted">Muted</Badge>
                </div>

                {/* ── Card ── */}
                <Card className="max-w-sm mb-8">
                    <CardHeader>
                        <CardTitle>Card title</CardTitle>
                        <CardDescription>Supporting description text for this card.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-foreground">
                            Card body content goes here. Token-only, no hardcoded colors.
                        </p>
                    </CardContent>
                    <CardFooter className="gap-2">
                        <Button variant="default" size="sm">Save</Button>
                        <Button variant="ghost" size="sm">Cancel</Button>
                    </CardFooter>
                </Card>

                {/* ── Dropdown ── */}
                <div className="mb-8">
                    <DropdownMenu defaultOpen={false}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">Open dropdown</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuLabel>Menu label</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Item one</DropdownMenuItem>
                            <DropdownMenuItem>Item two</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Destructive</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* ── Toasts ── */}
                <div className="flex flex-wrap gap-3 mb-8">
                    <Button
                        variant="outline"
                        onClick={() => toast("Info toast message")}
                    >
                        Toast: info
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => toast.success("Success!")}
                    >
                        Toast: success
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => toast.error("Error occurred")}
                    >
                        Toast: error
                    </Button>
                </div>

                <SectionDivider />

                {/* ── States ── */}
                <SectionHeading>{t.preview.statesSection}</SectionHeading>
                <div className="space-y-6">
                    <div>
                        <p className="text-sm text-muted-foreground mb-3">Loading</p>
                        <LoadingSpinner size="md" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-3">Empty</p>
                        <div className="flex flex-col items-center justify-center h-32 rounded-xl border border-dashed border-border text-muted-foreground gap-2">
                            <Image className="h-8 w-8 opacity-40" aria-hidden="true" />
                            <span className="text-sm">No items yet</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-3">Error</p>
                        <ErrorBanner message="Failed to load data. Please try again." />
                    </div>
                </div>

                <SectionDivider />

                {/* ── Icons ── */}
                <SectionHeading>{t.preview.iconsSection}</SectionHeading>
                <div className="flex flex-wrap gap-4">
                    {[
                        { icon: Heart, label: "Heart" },
                        { icon: Star, label: "Star" },
                        { icon: Search, label: "Search" },
                        { icon: Bell, label: "Bell" },
                        { icon: User, label: "User" },
                        { icon: Settings, label: "Settings" },
                        { icon: MapPin, label: "Location" },
                        { icon: Calendar, label: "Calendar" },
                        { icon: Image, label: "Photo" },
                        { icon: Menu, label: "Menu" },
                        { icon: Check, label: "Check" },
                        { icon: X, label: "Close" },
                    ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex flex-col items-center gap-1.5">
                            <div className="p-2 rounded-xl bg-muted">
                                <Icon className="h-5 w-5 text-foreground" aria-hidden="true" />
                            </div>
                            <span className="text-xs text-muted-foreground">{label}</span>
                        </div>
                    ))}
                </div>

                <SectionDivider />

                {/* ── Option Pickers ── */}
                <SectionHeading>{t.preview.optionPickersSection}</SectionHeading>
                <div className="space-y-6">
                    <div>
                        <p className="text-sm text-muted-foreground mb-3">Select — default / sm / disabled</p>
                        <div className="flex flex-wrap items-center gap-4">
                            <Select defaultValue="option1">
                                <SelectTrigger className="w-[180px]" data-testid="select--preview-default">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="option1">Option 1</SelectItem>
                                    <SelectItem value="option2">Option 2</SelectItem>
                                    <SelectItem value="option3">Option 3</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select defaultValue="option1">
                                <SelectTrigger size="sm" className="w-[160px]" data-testid="select--preview-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="option1">Option 1</SelectItem>
                                    <SelectItem value="option2">Option 2</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select disabled defaultValue="option1">
                                <SelectTrigger className="w-[180px]" data-testid="select--preview-disabled">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="option1">Option 1</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm text-muted-foreground mb-3">DropdownMenu — profile style</p>
                        <DropdownMenu defaultOpen={false}>
                            <DropdownMenuTrigger asChild aria-label="Profile menu">
                                <Button variant="outline" className="gap-2">
                                    <User className="h-4 w-4" />
                                    Profile
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                                <DropdownMenuLabel className="px-3 py-2">Tawatchai P.</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer py-2.5 px-3">My Profile</DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer py-2.5 px-3">My Bookings</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer py-2.5 px-3 text-destructive focus:bg-destructive/10 focus:text-destructive">
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div>
                        <p className="text-sm text-muted-foreground mb-3">Popover + Command</p>
                        <Popover open={commandOpen} onOpenChange={setCommandOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="gap-2" aria-label="Search location" data-testid="btn--preview-command">
                                    <MapPin className="h-4 w-4" />
                                    Search location
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search..." />
                                    <CommandList>
                                        <CommandEmpty>No results.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem>Chiang Mai</CommandItem>
                                            <CommandItem>Kanchanaburi</CommandItem>
                                            <CommandItem>Khao Yai</CommandItem>
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <SectionDivider />

                {/* ── FilterChip ── */}
                <SectionHeading>{t.preview.filterChipSection}</SectionHeading>
                <div className="space-y-8">
                    <div>
                        <p className="text-sm text-muted-foreground mb-3">pill</p>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { id: "hiking", label: "Hiking", icon: Mountain },
                                { id: "swimming", label: "Swimming", icon: Waves },
                                { id: "camping", label: "Camping", icon: Tent },
                                { id: "disabled-item", label: "Unavailable", disabled: true },
                            ].map((item) => (
                                <FilterChip
                                    key={item.id}
                                    variant="pill"
                                    selected={pillSelected.includes(item.id)}
                                    onToggle={() => togglePill(item.id)}
                                    label={item.label}
                                    icon={item.icon}
                                    disabled={item.disabled}
                                    data-testid={`filter-chip--pill-preview-${item.id}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-sm text-muted-foreground mb-3">card</p>
                        <div className="grid grid-cols-2 gap-4 max-w-sm">
                            {[
                                { id: "campground", label: "Campground", icon: Tent },
                                { id: "mountain", label: "Mountain", icon: Mountain },
                                { id: "lake", label: "Lakefront", icon: Waves },
                            ].map((item) => (
                                <FilterChip
                                    key={item.id}
                                    variant="card"
                                    selected={cardSelected.includes(item.id)}
                                    onToggle={() => toggleCard(item.id)}
                                    label={item.label}
                                    icon={item.icon}
                                    data-testid={`filter-chip--card-preview-${item.id}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-sm text-muted-foreground mb-3">icon-card</p>
                        <div className="grid grid-cols-3 gap-3 max-w-sm">
                            {[
                                { id: "drive", label: "Drive-in", icon: Tent },
                                { id: "walk", label: "Walk-in", icon: Mountain },
                                { id: "boat", label: "Boat", icon: Waves },
                            ].map((item) => (
                                <FilterChip
                                    key={item.id}
                                    variant="icon-card"
                                    selected={iconCardSelected.includes(item.id)}
                                    onToggle={() => toggleIconCard(item.id)}
                                    label={item.label}
                                    icon={item.icon}
                                    aria-label={item.label}
                                    data-testid={`filter-chip--icon-card-preview-${item.id}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <SectionDivider />

                <SectionDivider />

                {/* ── DS-3 Input / Card / Modal shell ── */}
                <SectionHeading>DS-3 Input / Card / Modal grammar</SectionHeading>

                {/* Input size grid */}
                <div className="space-y-4 mb-8">
                    <p className="text-sm text-muted-foreground mb-3">Input size variants — inputSize prop (sm / md / lg) — all rounded-full</p>
                    <div className="space-y-3 max-w-sm">
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide">sm (h-9)</label>
                            <Input inputSize="sm" placeholder="inputSize=&quot;sm&quot; h-9 rounded-full" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide">md — default (h-11)</label>
                            <Input placeholder="inputSize=&quot;md&quot; h-11 rounded-full (default)" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide">lg (h-12)</label>
                            <Input inputSize="lg" placeholder="inputSize=&quot;lg&quot; h-12 rounded-full" />
                        </div>
                    </div>
                </div>

                {/* Card sample */}
                <div className="mb-8">
                    <p className="text-sm text-muted-foreground mb-3">Card — primitive rounded-3xl (no override needed)</p>
                    <Card className="max-w-sm shadow-sm border-border">
                        <CardHeader>
                            <CardTitle>Card rounded-3xl</CardTitle>
                            <CardDescription>Primitive bakes rounded-3xl. Consumer adds only border/shadow if needed.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-foreground">No rounded override in consumer className — the primitive provides it.</p>
                        </CardContent>
                        <CardFooter className="gap-2">
                            <Button variant="default" size="sm">Action</Button>
                            <Button variant="ghost" size="sm">Cancel</Button>
                        </CardFooter>
                    </Card>
                </div>

                {/* Modal shell note */}
                <div className="mb-8 p-4 rounded-2xl border border-border bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Modal shell grammar (DS-3)</p>
                    <ul className="text-sm text-foreground space-y-1">
                        <li>DialogContent — primitive rounded-3xl (no consumer override)</li>
                        <li>AlertDialogContent — primitive rounded-3xl</li>
                        <li>Close button — size=&quot;icon&quot; (h-11 w-11) top-right + aria-label=&quot;Close&quot;</li>
                    </ul>
                </div>

                <SectionDivider />

                {/* ── DS-2 Button grammar + Thai type (font-verification kitchen-sink, not i18n keys) ── */}
                <SectionHeading>DS-2 Button grammar + Sarabun Thai type</SectionHeading>

                {/* Button size grid: sm / md / lg × variants */}
                <div className="space-y-6">
                    <div>
                        <p className="text-sm text-muted-foreground mb-3">size=sm (h-9)</p>
                        <div className="flex flex-wrap gap-3">
                            <Button size="sm" variant="default">Default sm</Button>
                            <Button size="sm" variant="secondary">Secondary sm</Button>
                            <Button size="sm" variant="outline">Outline sm</Button>
                            <Button size="sm" variant="ghost">Ghost sm</Button>
                            <Button size="sm" variant="destructive">Destructive sm</Button>
                            <Button size="sm" disabled>Disabled sm</Button>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-3">size=default / md (h-11)</p>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="default">Default md</Button>
                            <Button variant="secondary">Secondary md</Button>
                            <Button variant="outline">Outline md</Button>
                            <Button variant="ghost">Ghost md</Button>
                            <Button variant="destructive">Destructive md</Button>
                            <Button disabled>Disabled md</Button>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-3">size=lg (h-12) — primary CTA</p>
                        <div className="flex flex-wrap gap-3">
                            <Button size="lg" variant="default">Default lg</Button>
                            <Button size="lg" variant="secondary">Secondary lg</Button>
                            <Button size="lg" variant="outline">Outline lg</Button>
                            <Button size="lg" variant="ghost">Ghost lg</Button>
                            <Button size="lg" variant="destructive">Destructive lg</Button>
                            <Button size="lg" disabled>Disabled lg</Button>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground mb-3">icon row (size-11 / size-9 / size-11)</p>
                        <div className="flex flex-wrap gap-3 items-center">
                            <Button size="icon-sm" variant="outline" aria-label="Icon sm">
                                <Search className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="outline" aria-label="Icon md (default)">
                                <Search className="h-4 w-4" />
                            </Button>
                            <Button size="icon-lg" variant="outline" aria-label="Icon lg">
                                <Search className="h-5 w-5" />
                            </Button>
                            <Button size="icon" variant="default" aria-label="Icon primary">
                                <Heart className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" aria-label="Icon ghost">
                                <Bell className="h-4 w-4" />
                            </Button>
                            <Button size="icon" disabled aria-label="Icon disabled">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Thai type verification — Sarabun font */}
                <div className="mt-8 space-y-3 p-6 rounded-3xl border border-border bg-card">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Sarabun Thai font verification</p>
                    <h2 className="font-display text-2xl font-semibold text-foreground">
                        ค้นหาแคมป์ที่ใช่สำหรับคุณ
                    </h2>
                    <p className="text-base text-foreground leading-relaxed">
                        เลือกสถานที่กางเต็นท์ที่ดีที่สุดจากทั่วประเทศ พร้อมรีวิวจริงจากนักผจญภัย
                    </p>
                </div>

                <SectionDivider />

                {/* ── Image Resilience ── */}
                <SectionHeading>{t.preview.imageWithFallbackSection}</SectionHeading>
                <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                        <ImageWithFallback
                            src="/placeholder-camp.svg"
                            alt="Camp photo placeholder"
                            className="aspect-square rounded-xl"
                            imgClassName="object-cover"
                            data-testid="img--preview-good"
                            sizes="(max-width: 640px) 33vw, 200px"
                        />
                        <span className="text-xs text-muted-foreground text-center">{t.preview.imageGood}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        <ImageWithFallback
                            src="https://broken.invalid/404.jpg"
                            alt="Broken image example"
                            className="aspect-square rounded-xl"
                            data-testid="img--preview-broken"
                            sizes="(max-width: 640px) 33vw, 200px"
                            unoptimized
                        />
                        <span className="text-xs text-muted-foreground text-center">{t.preview.imageBroken}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        <ImageWithFallback
                            src={undefined}
                            alt="No source example"
                            className="aspect-square rounded-xl"
                            data-testid="img--preview-nosrc"
                            sizes="(max-width: 640px) 33vw, 200px"
                        />
                        <span className="text-xs text-muted-foreground text-center">{t.preview.imageNone}</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
