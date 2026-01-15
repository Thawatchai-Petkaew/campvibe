"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Label } from "./label";
import { AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface InputFieldProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  hint?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      label,
      error,
      hint,
      helperText,
      containerClassName,
      labelClassName,
      leftIcon,
      rightIcon,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId();
    const hasError = !!error;
    const displayText = error || hint || helperText;
    const isError = hasError;

    // Check if label text might overflow (more than 1 line)
    const labelRef = React.useRef<HTMLLabelElement>(null);
    const [isTruncated, setIsTruncated] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    React.useEffect(() => {
      if (label && labelRef.current) {
        const element = labelRef.current;
        // Check if text is truncated (scrollWidth > clientWidth)
        const truncated = element.scrollWidth > element.clientWidth;
        setIsTruncated(truncated);
      }
    }, [label]);

    return (
      <div className={cn("space-y-2", containerClassName)}>
        {label && (
          <Popover open={isTruncated && isHovered} onOpenChange={setIsHovered}>
            <PopoverTrigger asChild>
              <Label
                ref={labelRef}
                htmlFor={inputId}
                onMouseEnter={() => isTruncated && setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={cn(
                  "text-xs font-regular uppercase tracking-widest text-muted-foreground ml-4 block truncate",
                  isTruncated && "cursor-help hover:text-foreground transition-colors",
                  labelClassName
                )}
              >
                {label}
              </Label>
            </PopoverTrigger>
            {isTruncated && (
              <PopoverContent
                side="top"
                align="start"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="max-w-xs p-2 text-xs font-regular uppercase tracking-widest text-muted-foreground"
              >
                {label}
              </PopoverContent>
            )}
          </Popover>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
              {leftIcon}
            </div>
          )}
          <Input
            ref={ref}
            id={inputId}
            aria-invalid={hasError}
            aria-describedby={displayText ? `${inputId}-hint` : undefined}
            className={cn(
              hasError && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
              leftIcon && "pl-12",
              rightIcon && "pr-12",
              className
            )}
            {...props}
          />
          {rightIcon && typeof rightIcon === 'object' && 'type' in rightIcon ? (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
              {rightIcon}
            </div>
          ) : rightIcon ? (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
              {rightIcon}
            </div>
          ) : null}
        </div>

        {displayText && (
          <p
            id={`${inputId}-hint`}
            className={cn(
              "text-sm px-4",
              isError ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {displayText}
          </p>
        )}
      </div>
    );
  }
);

InputField.displayName = "InputField";

export { InputField };
