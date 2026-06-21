"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { IconSun, IconDeviceLaptop, IconMoon } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

type ThemeOption = "light" | "system" | "dark";

interface ThemeButtonDef {
    value: ThemeOption;
    icon: React.ElementType;
    labelKey: "themeLight" | "themeSystem" | "themeDark";
    testId: string;
}

const THEME_OPTIONS: ThemeButtonDef[] = [
    { value: "light", icon: IconSun, labelKey: "themeLight", testId: "btn--theme-light" },
    { value: "system", icon: IconDeviceLaptop, labelKey: "themeSystem", testId: "btn--theme-system" },
    { value: "dark", icon: IconMoon, labelKey: "themeDark", testId: "btn--theme-dark" },
];

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();
    // Guard against hydration mismatch: next-themes only resolves the active
    // theme after mount. Render in a neutral state until mounted.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <div
            role="group"
            aria-label={t.nav.themeToggleGroup}
            className="flex items-center gap-1 px-1 py-1"
        >
            {THEME_OPTIONS.map(({ value, icon: Icon, labelKey, testId }) => {
                const isSelected = mounted && theme === value;
                return (
                    <Button
                        key={value}
                        variant="ghost"
                        size="icon"
                        aria-label={t.nav[labelKey]}
                        aria-pressed={isSelected}
                        data-testid={testId}
                        onClick={() => setTheme(value)}
                        className={[
                            "min-h-[44px] min-w-[44px] rounded-md transition-colors",
                            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            isSelected
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        ].join(" ")}
                    >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                    </Button>
                );
            })}
        </div>
    );
}
