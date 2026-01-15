import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
    size?: "sm" | "md" | "lg";
    className?: string;
    fullScreen?: boolean;
    text?: string;
}

export function LoadingSpinner({ 
    size = "md", 
    className,
    fullScreen = false,
    text
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: "w-6 h-6 border-2",
        md: "w-8 h-8 border-3",
        lg: "w-12 h-12 border-4"
    };

    const spinner = (
        <div className={cn(
            "flex flex-col items-center justify-center gap-3",
            fullScreen && "min-h-screen",
            !fullScreen && "h-64",
            className
        )}>
            <div className={cn(
                "border-primary border-t-transparent rounded-full animate-spin",
                sizeClasses[size]
            )} />
            {text && (
                <p className="text-muted-foreground font-medium animate-pulse">
                    {text}
                </p>
            )}
        </div>
    );

    return spinner;
}
