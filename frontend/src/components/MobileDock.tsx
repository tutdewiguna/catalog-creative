"use client";

import React, { useState, useEffect } from "react";
import { Home, Layers, ShoppingCart, User, History } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const DOCK_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/services", label: "Services", icon: Layers },
  { href: "/history", label: "History", icon: History },
  { href: "/account", label: "Account", icon: User },
];

export default function MobileDock() {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  const hideDock = 
    pathname.startsWith("/admin") || 
    pathname.startsWith("/login") || 
    pathname.startsWith("/register") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/orders/");

  if (hideDock) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      aria-label="Quick navigation"
    >
      <div className="bg-accent/95 backdrop-blur-lg border-t border-accent/30 mobile-bottom-safe">
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-4">
          {DOCK_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = (href === "/" && pathname === href) || (href !== "/" && pathname.startsWith(href));
            return (
              <a
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-xs font-medium w-16 transition-colors text-light/70",
                  isActive
                    ? "text-primary"
                    : "hover:text-primary"
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                <span>{label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
