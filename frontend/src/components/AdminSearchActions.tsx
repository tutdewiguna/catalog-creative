"use client";

import React from "react";
import { Plus } from "lucide-react";
import Button from "@/components/Button";
import { cn } from "@/lib/utils";

interface AdminSearchActionsProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  searchAriaLabel?: string;
  className?: string;
  inputClassName?: string;
  actions?: React.ReactNode;
  onAdd?: () => void;
  addButtonLabel?: string;
  addButtonAriaLabel?: string;
  addDisabled?: boolean;
}

export default function AdminSearchActions({
  searchValue,
  onSearchChange,
  placeholder = "Cari...",
  searchAriaLabel,
  className,
  inputClassName,
  actions,
  onAdd,
  addButtonLabel = "Add item",
  addButtonAriaLabel,
  addDisabled = false,
}: AdminSearchActionsProps) {
  const hasVisibleAddLabel = Boolean(addButtonLabel?.trim());
  const effectiveAddAriaLabel = addButtonAriaLabel || addButtonLabel || "Add item";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end w-full sm:w-auto",
        className
      )}
    >
      <input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={placeholder}
        aria-label={searchAriaLabel || placeholder}
        className={cn("form-input w-full sm:w-64", inputClassName)}
      />
      {actions ??
        (onAdd && (
          <Button
            onClick={onAdd}
            disabled={addDisabled}
            aria-label={effectiveAddAriaLabel}
            className="w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Plus size={18} aria-hidden="true" />
            {hasVisibleAddLabel ? (
              <span>{addButtonLabel}</span>
            ) : (
              <span className="sr-only">{effectiveAddAriaLabel}</span>
            )}
          </Button>
        ))}
    </div>
  );
}
