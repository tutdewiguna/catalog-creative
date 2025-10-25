"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AdminPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export default function AdminPageHeader({
  title,
  description,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-dark">{title}</h1>
        {description && (
          <div className="text-sm text-muted">{description}</div>
        )}
      </div>
      {actions ? <div className="w-full lg:w-auto">{actions}</div> : null}
    </div>
  );
}
