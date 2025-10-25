"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface FormInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export default function FormInput({
  label,
  error,
  helperText,
  className,
  id,
  ...props
}: FormInputProps) {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-dark"
        >
          {label}
        </label>
      )}

      <input
        id={inputId}
        className={cn(
          "w-full rounded-xl border border-accent/15 bg-light",
          "px-4 py-3 text-base text-dark",
          "placeholder:text-muted/60",
          "focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none transition-all duration-200",
          error && "border-danger focus:ring-danger/20",
          className
        )}
        {...props}
      />

      {helperText && !error && (
        <p className="text-xs text-muted/80">{helperText}</p>
      )}
      {error && <p className="text-xs text-danger font-medium">{error}</p>}
    </div>
  );
}
