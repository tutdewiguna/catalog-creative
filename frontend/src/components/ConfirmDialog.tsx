"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import Portal from "./Portal";
import Button from "./Button";
import { clsx } from "@/lib/helpers";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "outline" | "success" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-dark/70 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 12 }}
          className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-accent/10 px-6 py-4">
            <h2 className="text-lg font-semibold text-dark">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-muted hover:text-dark transition hover:bg-light"
              aria-label="Close confirmation dialog"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-6 py-5 text-sm text-muted">
            {description ? (
              <p>{description}</p>
            ) : (
              <p>Are you sure you want to continue?</p>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-accent/10 bg-light px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={loading}
              className={clsx(loading && "opacity-80")}
            >
              {loading ? "Processing..." : confirmText}
            </Button>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}
