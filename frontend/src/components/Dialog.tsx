"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import Portal from "./Portal";

interface DialogContextValue {
  onOpenChange?: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within <Dialog>");
  }
  return context;
}

interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange?.(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <DialogContext.Provider value={{ onOpenChange }}>
      <Portal>
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-dark/70"
            onClick={() => onOpenChange?.(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-2xl px-0 sm:px-2">
            {children}
          </div>
        </div>
      </Portal>
    </DialogContext.Provider>
  );
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DialogContent({ className, ...props }: DialogContentProps) {
  useDialogContext();

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        "relative w-full rounded-2xl bg-white p-6 shadow-2xl",
        className
      )}
      {...props}
    />
  );
}

interface DialogSectionProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DialogHeader({ className, ...props }: DialogSectionProps) {
  return (
    <div className={cn("space-y-1.5", className)} {...props} />
  );
}

export function DialogFooter({ className, ...props }: DialogSectionProps) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-xl font-semibold text-dark", className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted", className)} {...props} />
  );
}

DialogContext.displayName = "DialogContext";
