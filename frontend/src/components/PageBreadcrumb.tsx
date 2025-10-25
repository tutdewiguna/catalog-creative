"use client";

import { ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Breadcrumb, { BreadcrumbItem } from "./Breadcrumb";

interface PageBreadcrumbProps {
  items?: BreadcrumbItem[];
  children?: ReactNode;
  className?: string;
  containerClassName?: string;
  contentClassName?: string;
  variant?: "default" | "overlay" | "admin";
  breadcrumbClassName?: string;
}

const formatSegment = (segment: string) => {
  if (!segment) return "";
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export default function PageBreadcrumb({
  items,
  children,
  className,
  containerClassName,
  contentClassName,
  variant = "default",
  breadcrumbClassName,
}: PageBreadcrumbProps) {
  const pathname = usePathname();

  const autoItems = useMemo(() => {
    if (!pathname || pathname === "/") {
      return [{ label: "Home", href: "/" }];
    }

    const segments = pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    const crumbs: BreadcrumbItem[] = segments.map((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/");
      return {
        label: formatSegment(segment),
        href: index === segments.length - 1 ? undefined : href,
      };
    });

    return [{ label: "Home", href: "/" }, ...crumbs];
  }, [pathname]);

  const resolvedItems = items && items.length > 0 ? items : autoItems;
  const isOverlay = variant === "overlay";
  const isAdmin = variant === "admin";

  return (
    <div
      className={cn(
        isOverlay ? "bg-transparent" : isAdmin ? "bg-transparent" : "bg-white/90",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 lg:px-8",
          isOverlay ? "py-4 md:py-6" : isAdmin ? "py-4" : "py-6 sm:py-8",
          isAdmin && "max-w-none",
          containerClassName,
        )}
      >
        {isAdmin ? (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/15",
              "bg-white/80 px-5 py-4 shadow-sm backdrop-blur-sm",
            )}
          >
            <Breadcrumb
              items={resolvedItems}
              inverted={false}
              className={cn("text-sm font-medium text-muted", breadcrumbClassName)}
            />
            {children && (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 text-sm text-muted",
                  contentClassName,
                )}
              >
                {children}
              </div>
            )}
          </div>
        ) : (
          <>
            <Breadcrumb
              items={resolvedItems}
              inverted={isOverlay}
              className={breadcrumbClassName}
            />
            {children && (
              <div
                className={cn(
                  "flex flex-col gap-4",
                  contentClassName,
                )}
              >
                {children}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

