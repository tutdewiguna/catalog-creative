"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  inverted?: boolean;
  className?: string;
}

export default function Breadcrumb({ items, inverted = false, className }: BreadcrumbProps) {
  const textBase = inverted ? "text-white/80" : "text-muted";
  const linkBase = inverted ? "text-white/80 hover:text-white" : "hover:text-primary";
  const currentBase = inverted ? "text-white font-semibold" : "text-dark font-medium";
  const chevronColor = inverted ? "text-white/50" : "text-muted/60";

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className={cn("flex flex-wrap items-center gap-1 text-sm", textBase, className)}>
        {items.map((item, index) => (
          <li key={index} className="inline-flex items-center gap-1">
            {index > 0 && <ChevronRight size={16} className={chevronColor} />}
            {item.href ? (
              <a href={item.href} className={linkBase}>
                {item.label}
              </a>
            ) : (
              <span className={currentBase}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}


