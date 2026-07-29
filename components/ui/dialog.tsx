"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-overlay/25 duration-100 supports-backdrop-filter:backdrop-blur-md data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)

  // CAM-540 — a Radix popup that disables outside pointer events while open
  // (Select is always one; Popover/DropdownMenu are too when `modal`) shares
  // the SAME layer-stacking context as this Dialog. While that popup is the
  // topmost layer, Radix sets `pointer-events: none` on every layer BELOW
  // it — including this dialog's own content box — so a click that lands
  // visually inside the dialog (anywhere that isn't the popup itself) is
  // not hit-tested there at all; it passes straight through to the overlay
  // underneath. The dialog's own dismissable layer then reads that as a
  // genuine backdrop click and closes — even though the user never touched
  // the overlay.
  //
  // A same-origin check on the interaction's `event.target` (e.g. "is it
  // inside a `[data-radix-popper-content-wrapper]`") does NOT catch this:
  // the target really is the overlay by the time it's observed, and this
  // repo's <Select> defaults to Radix's "item-aligned" position (no popper
  // wrapper element at all — verified empirically, see story.md). The
  // reliable signal is this dialog's own content node's `pointer-events`
  // value AT THE MOMENT OF THE ORIGINAL POINTERDOWN — captured via a
  // document-level capture-phase listener so it runs before the nested
  // popup can close/unmount itself, then read back later when
  // `onPointerDownOutside` fires (Dialog defers that to the following
  // `click` event, by which point the nested popup is already gone).
  const suppressNextDismissRef = React.useRef(false)

  React.useEffect(() => {
    const recordPointerDown = () => {
      const node = contentRef.current
      suppressNextDismissRef.current = !!node && node.style.pointerEvents === "none"
    }
    document.addEventListener("pointerdown", recordPointerDown, true)
    return () => document.removeEventListener("pointerdown", recordPointerDown, true)
  }, [])

  const handlePointerDownOutside: NonNullable<
    React.ComponentProps<typeof DialogPrimitive.Content>["onPointerDownOutside"]
  > = React.useCallback(
    (event) => {
      onPointerDownOutside?.(event)
      if (suppressNextDismissRef.current) {
        suppressNextDismissRef.current = false
        event.preventDefault()
      }
    },
    [onPointerDownOutside]
  )

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-3xl bg-popover p-6 text-sm text-popover-foreground shadow-2xl ring-1 ring-foreground/5 duration-100 outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        ref={contentRef}
        onPointerDownOutside={handlePointerDownOutside}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-4 right-4 bg-secondary"
              size="icon"
              aria-label="Close"
            >
              <X
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
