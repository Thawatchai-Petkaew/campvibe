"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface TruncatedLabelProps {
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
  as?: "label" | "div" | "span";
}

export function TruncatedLabel({ 
  children, 
  className, 
  htmlFor,
  as = "label"
}: TruncatedLabelProps) {
  const labelRef = React.useRef<HTMLLabelElement | HTMLDivElement | HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    if (labelRef.current) {
      const element = labelRef.current;
      // Check if text is truncated (scrollWidth > clientWidth)
      const truncated = element.scrollWidth > element.clientWidth;
      setIsTruncated(truncated);
    }
  }, [children]);

  const baseClassName = cn(
    "block truncate",
    isTruncated && "cursor-help hover:text-foreground transition-colors",
    className
  );

  const labelContent = (
    <Popover open={isTruncated && isHovered} onOpenChange={setIsHovered}>
      <PopoverTrigger asChild>
        {as === "label" ? (
          <Label
            ref={labelRef as React.Ref<HTMLLabelElement>}
            htmlFor={htmlFor}
            onMouseEnter={() => isTruncated && setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={baseClassName}
          >
            {children}
          </Label>
        ) : as === "div" ? (
          <div
            ref={labelRef as React.Ref<HTMLDivElement>}
            onMouseEnter={() => isTruncated && setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={baseClassName}
          >
            {children}
          </div>
        ) : (
          <span
            ref={labelRef as React.Ref<HTMLSpanElement>}
            onMouseEnter={() => isTruncated && setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={baseClassName}
          >
            {children}
          </span>
        )}
      </PopoverTrigger>
      {isTruncated && (
        <PopoverContent
          side="top"
          align="start"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="max-w-xs p-2 text-xs font-regular uppercase tracking-widest text-muted-foreground"
        >
          {children}
        </PopoverContent>
      )}
    </Popover>
  );

  return labelContent;
}
