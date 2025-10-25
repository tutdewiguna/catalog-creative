"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Folder,
  MessageSquare,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  BarChart3,
  TicketPercent,
  GalleryVertical,
  Briefcase,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAdminNotificationStore } from "@/store/adminNotifications";
import PageBreadcrumb from "@/components/PageBreadcrumb";

type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  roles: Array<"admin" | "user">;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/admin/dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
        roles: ["admin", "user"],
      },
      {
        href: "/admin/analytics",
        icon: BarChart3,
        label: "Analytics",
        roles: ["admin"],
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        href: "/admin/orders",
        icon: ShoppingBag,
        label: "Orders",
        roles: ["admin", "user"],
      },
      {
        href: "/admin/messages",
        icon: MessageSquare,
        label: "Messages",
        roles: ["admin", "user"],
      },
       {
        href: "/admin/promocodes",
        icon: TicketPercent,
        label: "Promo Codes",
        roles: ["admin"],
      },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/services", icon: Package, label: "Services", roles: ["admin"] },
      {
        href: "/admin/gallery",
        icon: GalleryVertical,
        label: "Gallery",
        roles: ["admin"],
      },
      {
        href: "/admin/experiences",
        icon: Briefcase,
        label: "Experiences",
        roles: ["admin"],
      },
      {
        href: "/admin/categories",
        icon: Folder,
        label: "Categories",
        roles: ["admin"],
      },
    ],
  },
  {
    title: "System",
    items: [
       {
        href: "/admin/settings",
        icon: Settings,
        label: "Settings",
        roles: ["admin"],
      },
    ]
  }
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, role, profile, hydrate } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const hasNewOrders = useAdminNotificationStore((state) => state.hasNewOrders);
  const flagNewOrders = useAdminNotificationStore((state) => state.flagNewOrders);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    setIsClient(true);
    const storedToken = localStorage.getItem("adm_token");
    if (!storedToken) router.push("/admin/login");
  }, [router, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    if (role === "user") {
      return;
    }

    let isActive = true;

    const fetchOrders = async () => {
      try {
        const storedToken = localStorage.getItem("adm_token");
        if (!storedToken) {
          return;
        }
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/orders`,
          {
            headers: { Authorization: `Bearer ${storedToken}` },
          }
        );
        if (!isActive || !res.ok) {
          return;
        }
        const payload = await res.json();
        if (!Array.isArray(payload)) {
          return;
        }
        const ids = payload.map((order: { id: number }) => order.id);
        flagNewOrders(ids);
      } catch (error) {
        console.error("Failed to check order notifications:", error);
      }
    };

    fetchOrders();

    const interval = window.setInterval(fetchOrders, 30000);
    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [token, flagNewOrders, role]);

  useEffect(() => {
    if (!isClient || !token) {
      return;
    }
    if (role !== "user") {
      return;
    }
    const allowed = ["/admin/dashboard", "/admin/orders", "/admin/messages"];
    if (!allowed.includes(pathname)) {
      router.replace("/admin/dashboard");
    }
  }, [isClient, token, role, pathname, router]);

  const effectiveRole = role ?? "admin";

  if (!isClient || !token) {
    return (
      <div className="flex h-screen items-center justify-center bg-light text-dark">
        <p>Loading & verifying authentication...</p>
      </div>
    );
  }

  const filteredNavGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(effectiveRole))
  })).filter(group => group.items.length > 0);


  const displayName =
    profile?.name || (effectiveRole === "admin" ? "Admin" : "Team Member");
  const displayEmail =
    profile?.email ||
    (effectiveRole === "admin" ? "administrator@workspace" : undefined);

  return (
    <div className="flex h-screen bg-light text-dark">
      <aside
        className={cn(
          "bg-accent text-light border-r border-accent/30 w-64 min-h-screen p-3 flex flex-col justify-between fixed lg:relative transition-transform duration-300 ease-in-out z-20",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div>
          {/* Logo Section (Centered) */}
          <div className="flex items-center justify-center mt-5 mb-5 relative">
             <Image
                src="/images/logo-white.svg"
                alt="Logo"
                width={70}
                height={70}
                className="rounded-lg"
             />
             <button
               className="lg:hidden text-light/70 hover:text-primary absolute right-0 top-1/2 -translate-y-1/2"
               onClick={() => setSidebarOpen(false)}
             >
               <X size={22} />
             </button>
          </div>
          {/* Navigation Section (Items are left-aligned within this section) */}
          <nav className="flex flex-col space-y-4">
            {filteredNavGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {group.title && (
                    <h3 className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-light/50">{group.title}</h3>
                )}
                <div className="space-y-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={cn(
                          "relative flex items-center gap-3 px-4 py-3 rounded-lg text-light/80 transition-colors", // px-4 adds padding left and right
                          "hover:bg-light/10 hover:text-primary",
                          pathname === item.href
                            ? "bg-light/15 text-primary font-semibold shadow-inner"
                            : ""
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                        {item.href === "/admin/orders" &&
                          effectiveRole === "admin" &&
                          hasNewOrders &&
                          pathname !== item.href && (
                            <span className="absolute right-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-danger shadow-[0_0_0_4px_rgba(178,58,72,0.25)]" />
                          )}
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Sign Out Button (Left-aligned within its container) */}
        <button
          onClick={() => {
            setSidebarOpen(false);
            router.push("/admin/logout");
          }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-light/80 hover:bg-danger/15 hover:text-danger transition mt-8"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign out</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center p-4 bg-light border-b border-accent/15 sticky top-0 z-10 h-16">
          <button
            className="lg:hidden text-accent hover:text-primary"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right text-sm text-muted">
              <p>
                Welcome,&nbsp;
                <span className="font-semibold text-primary">{displayName}</span>
              </p>
              {displayEmail && (
                <p className="text-xs text-muted/70">{displayEmail}</p>
              )}
            </div>
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-dark">
              <User className="w-5 h-5" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-light">
          <PageBreadcrumb
            variant="admin"
            className="bg-light/80 backdrop-blur z-[9]"
            containerClassName="px-6 md:px-8"
            breadcrumbClassName="text-muted"
          />
          <div className="p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}