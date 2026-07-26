import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        // CAM-261: tint fill lowered to 2%/10% (was 10%/20%) — a same-hue tint
        // text-on-tint-background pair loses AA contrast as the fill opacity
        // rises toward the text hue (measured with real browser color-mix,
        // not an approximation); 2% light / 10% dark keeps 4.5:1+ on the
        // worst-case surface (card in dark mode) with margin. Border/ring
        // opacity are unaffected (axe's color-contrast rule only checks text).
        destructive:
          "bg-destructive/2 text-destructive border-destructive/30 focus-visible:ring-destructive/20 dark:bg-destructive/10 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        success:
          "bg-success/2 text-success border-success/30 focus-visible:ring-success/20 dark:bg-success/10 dark:focus-visible:ring-success/40 [a]:hover:bg-success/20",
        // warning: text stays warning-foreground (near-black) in light mode —
        // it is the ONLY pairing that clears AA against a light warning tint.
        // In dark mode warning-foreground is near-black-on-near-black against
        // the tint (contrast ~1.2-1.9, a critical failure) — dark:text-warning
        // (the full saturated amber) is the correct pairing there instead.
        warning:
          "bg-warning/2 text-warning-foreground border-warning/30 focus-visible:ring-warning/20 dark:bg-warning/10 dark:text-warning dark:focus-visible:ring-warning/40 [a]:hover:bg-warning/20",
        info:
          "bg-info/2 text-info border-info/30 focus-visible:ring-info/20 dark:bg-info/10 dark:focus-visible:ring-info/40 [a]:hover:bg-info/20",
        // CAM-261: text-foreground (was text-muted-foreground) — muted-foreground
        // on a solid bg-muted only reaches 4.14:1 in light mode (measured),
        // below the 4.5:1 AA floor for text-xs. text-foreground on bg-muted
        // clears AA with a large margin in both modes (token-only swap, no
        // new value — the underlying muted-foreground token itself is
        // out of this fix's scope; flagged for Designer follow-up).
        muted:
          "bg-muted text-foreground border-border [a]:hover:bg-muted/80",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary-ink underline-offset-4 hover:underline",
        overlay:
          "bg-card/85 backdrop-blur-sm text-foreground border-border/40",
      },
      shape: {
        default: "",
        pill: "rounded-full min-w-[1.25rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  shape = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, shape }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
