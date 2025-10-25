"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  shadow?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
}

export default function Card({
  children,
  className,
  shadow = true,
  bordered = true,
  hoverable = false,
  ...props
}: CardProps) {
  const baseStyle = "bg-white rounded-2xl transition-all duration-300";

  const shadowStyle = shadow ? "shadow-soft" : "";
  const borderStyle = bordered ? "border border-accent/10" : "";
  const hoverStyle = hoverable
    ? "hover:shadow-brand hover:-translate-y-1"
    : "";

  return (
    <div
      className={cn(baseStyle, shadowStyle, borderStyle, hoverStyle, className)}
      {...props}
    >
      {children}
    </div>
  );
}
