"use client";

import { cn } from "@/lib/utils";
import React from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "success" | "error" | "info" | "warning";
  icon?: boolean;
  title?: string;
}

export default function Alert({
  variant = "info",
  icon = true,
  title,
  children,
  className,
  ...props
}: AlertProps) {
  const variants = {
    success: {
      bg: "bg-success/10 text-success border-success/30",
      Icon: CheckCircle2,
    },
    error: {
      bg: "bg-danger/10 text-danger border-danger/30",
      Icon: XCircle,
    },
    info: {
      bg: "bg-info/20 text-accent border-info/30",
      Icon: Info,
    },
    warning: {
      bg: "bg-warning/20 text-warning border-warning/30",
      Icon: AlertTriangle,
    },
  };

  const { bg, Icon } = variants[variant];

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 border rounded-xl",
        bg,
        "shadow-soft",
        className
      )}
      {...props}
    >
      {icon && <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />}
      <div className="flex flex-col">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
