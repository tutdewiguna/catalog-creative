"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "success" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  fullWidth?: boolean;
  shape?: "rounded" | "circle" | "none";
}

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  shape = "rounded",
  className,
  children,
  ...props
}: ButtonProps) {
  const baseStyle =
    "inline-flex items-center justify-center font-semibold leading-none transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-light disabled:opacity-60 disabled:cursor-not-allowed";

  const shapes = {
    rounded: "rounded-xl",
    circle: "rounded-full",
    none: "",
  };

  const variants = {
    primary:
      "bg-primary text-dark hover:bg-[#c09c32] focus-visible:ring-primary/40 shadow-sm hover:shadow-md",
    outline:
      "border border-accent/60 text-accent bg-transparent hover:bg-accent/10 focus-visible:ring-accent/30",
    success:
      "bg-success text-light hover:bg-success/90 focus-visible:ring-success/40",
    danger:
      "bg-danger text-light hover:bg-danger/90 focus-visible:ring-danger/40",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-6 py-3 text-lg",
    icon: "h-10 w-10 p-0",
  };

  return (
    <button
      className={cn(
        baseStyle,
        shapes[shape],
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
