import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// CAM-662 — disabled is the flat --disabled/--disabled-foreground pair
// (never opacity); see button.tsx for why `!` is used.
const inputVariants = cva(
  "w-full min-w-0 rounded-full border border-transparent bg-input/50 px-3 py-1 text-base transition-[color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-disabled! disabled:text-disabled-foreground! aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      inputSize: {
        sm: "h-9",
        md: "h-11",
        // CAM-552 — steps at md (768px); 44px on a phone (the WCAG tap
        // floor), 48px from tablet up. See DESIGN.md §2 "Responsive scale".
        lg: "h-11 md:h-12",
      },
    },
    defaultVariants: {
      inputSize: "md",
    },
  }
)

export interface InputProps
  extends React.ComponentProps<"input">,
    VariantProps<typeof inputVariants> {}

function Input({ className, type, inputSize, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ inputSize }), className)}
      {...props}
    />
  )
}

export { Input }
