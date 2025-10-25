"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ShoppingBag,
  Package,
  Folder,
  MessageSquare,
  Activity as ActivityIcon,
} from "lucide-react";

import { useAuthStore } from "@/store/auth";
import { clsx, formatOrderStatus, formatUsdToRupiah } from "@/lib/helpers";
import Button from "@/components/Button";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

type DashboardCounts = {
  services: number;
  orders: number;
  categories: number;
  messages: number;
};

type DashboardOrder = {
  id: number;
  service_id: number;
  service_title: string;
  customer_name: string;
  customer_email: string;
  status: string;
  status_label: string;
  amount: number;
  created_at: string;
};

type DashboardActivity = {
  id: number;
  type: string;
  action: string;
  title: string;
  description: string;
  reference_id?: number;
  metadata?: Record<string, string>;
  created_at: string;
};

type DashboardResponse = {
  counts: DashboardCounts;
  order_summary: Record<string, number>;
  recent_orders: DashboardOrder[];
  activities: DashboardActivity[];
  order_activities: DashboardActivity[];
};

const defaultCounts: DashboardCounts = {
  services: 0,
  orders: 0,
  categories: 0,
  messages: 0,
};

const EMPTY_ORDER_SUMMARY: Record<string, number> = {};

const activityIcons: Record<string, LucideIcon> = {
  order: ShoppingBag,
  service: Package,
  category: Folder,
  message: MessageSquare,
};

const activityThemes: Record<string, { card: string; icon: string }> = {
  order: {
    card: "border-l-4 border-primary bg-accent/10 shadow-sm",
    icon: "bg-primary/15 text-primary",
  },
  service: {
    card: "bg-light",
    icon: "bg-accent/15 text-accent",
  },
  category: {
    card: "bg-light",
    icon: "bg-warning/25 text-warning",
  },
  message: {
    card: "bg-light",
    icon: "bg-danger/15 text-danger",
  },
  default: {
    card: "bg-light",
    icon: "bg-light text-muted",
  },
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("id-ID").format(value ?? 0);

const formatDateTime = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatLabel = (value: string) => {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getActivityBadges = (activity: DashboardActivity): string[] => {
  const meta = activity.metadata ?? {};
  const badges: string[] = [];

  if (activity.type === "order") {
    const status = meta.status_label || meta.status;
    if (status) {
      badges.push(formatOrderStatus(status));
    }
    if (meta.customer_name) {
      badges.push(meta.customer_name);
    }
    if (meta.service_title) {
      badges.push(meta.service_title);
    }
    if (meta.payment_method) {
      badges.push(meta.payment_method.toUpperCase());
    }
    if (meta.reason) {
      badges.push(meta.reason);
    }
  } else if (activity.type === "service") {
    if (meta.category_name) {
      badges.push(meta.category_name);
    }
    if (meta.price) {
      const priceNum = Number(meta.price);
      if (!Number.isNaN(priceNum)) {
        badges.push(formatUsdToRupiah(priceNum));
      }
    }
  } else if (activity.type === "category") {
    if (meta.slug) {
      badges.push(meta.slug);
    }
    if (meta.name && meta.name !== meta.slug) {
      badges.push(meta.name);
    }
  } else if (activity.type === "message") {
    if (meta.email) {
      badges.push(meta.email);
    }
    if (meta.subject) {
      badges.push(meta.subject);
    }
  }

  return Array.from(new Set(badges.filter(Boolean)));
};

type ActivityItemProps = {
  activity: DashboardActivity;
  emphasizeOrder?: boolean;
};

const ActivityItem: React.FC<ActivityItemProps> = ({
  activity,
  emphasizeOrder,
}) => {
  const Icon = activityIcons[activity.type] ?? ActivityIcon;
  const theme = activityThemes[activity.type] ?? activityThemes.default;
  const badges = getActivityBadges(activity);

  return (
    <div
      className={clsx(
        "rounded-2xl border border-accent/15 bg-white p-4 shadow-sm transition hover:shadow-md",
        theme.card,
        emphasizeOrder &&
          activity.type === "order" &&
          "ring-1 ring-primary/30 hover:ring-2 hover:ring-primary/40"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={clsx(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            theme.icon
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {formatLabel(activity.action)}
              </p>
              <p className="text-base font-semibold text-dark">
                {activity.title}
              </p>
            </div>
            <span className="text-xs text-muted">
              {formatDateTime(activity.created_at)}
            </span>
          </div>
          {activity.description && (
            <p className="text-sm text-muted">{activity.description}</p>
          )}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-light px-3 py-1 text-xs font-medium text-muted"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { token, role } = useAuthStore();
  const isAdmin = role === "admin";
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      setLoading(true);
      const storedToken = localStorage.getItem("adm_token");
      if (!storedToken) {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/stats`,
          {
            headers: { Authorization: `Bearer ${storedToken}` },
          }
        );
        if (!res.ok) {
          throw new Error(`Failed to load dashboard stats (${res.status})`);
        }
        const payload = await res.json();
        if (!cancelled) {
          const countsPayload = (payload.counts ??
            {}) as Partial<DashboardCounts>;
          const normalized: DashboardResponse = {
            counts: {
              ...defaultCounts,
              ...countsPayload,
            },
            order_summary: payload.order_summary ?? {},
            recent_orders: payload.recent_orders ?? [],
            activities: payload.activities ?? [],
            order_activities: payload.order_activities ?? [],
          };
          setData(normalized);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const counts = data?.counts ?? defaultCounts;
  const orderSummary = data?.order_summary ?? EMPTY_ORDER_SUMMARY;
  const recentOrders = data?.recent_orders ?? [];
  const orderActivities = data?.order_activities ?? [];
  const activities = data?.activities ?? [];
  const totalOrders = orderSummary.total ?? counts.orders ?? 0;

  const orderActivityPagination = usePagination(orderActivities, 5);
  const displayedOrderActivities = orderActivityPagination.paginatedItems;
  const activityPagination = usePagination(activities, 10);
  const displayedActivities = activityPagination.paginatedItems;

  const statCards: Array<{
    label: string;
    value: number;
    icon: LucideIcon;
    color: string;
    bg: string;
  }> = [
    {
      label: "Total Orders",
      value: counts.orders,
      icon: ShoppingBag,
      color: "text-primary",
      bg: "bg-primary/15",
    },
    {
      label: "Total Services",
      value: counts.services,
      icon: Package,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Total Categories",
      value: counts.categories,
      icon: Folder,
      color: "text-warning",
      bg: "bg-warning/20",
    },
    {
      label: "New Messages",
      value: counts.messages,
      icon: MessageSquare,
      color: "text-danger",
      bg: "bg-danger/15",
    },
  ];

  const orderSummaryEntries = useMemo(() => {
    return Object.entries(orderSummary)
      .filter(([key, value]) => key !== "total" && value > 0)
      .map(([key, value]) => ({
        key,
        label: formatOrderStatus(key),
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [orderSummary]);

  const isInitialLoading = !data && loading;

  if (isInitialLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted">Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!isAdmin && (
        <div className="rounded-2xl border border-accent/20 bg-accent/10 p-4 text-sm text-accent">
          <p className="font-semibold">Limited access mode</p>
          <p className="mt-1 text-accent/80">
            You&apos;re signed in as a workspace user. Dashboard insights, orders, and chat are available in read-only mode. Contact an administrator to request additional privileges.
          </p>
        </div>
      )}
      <div>
        <h1 className="text-3xl font-bold text-dark">Dashboard Overview</h1>
        <p className="mt-1 text-muted">
          {isAdmin
            ? "Get insights into the latest performance metrics of your studio."
            : "A quick look at current performance and recent activity."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex items-center justify-between rounded-2xl border border-accent/15 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div>
              <p className="text-sm text-muted">{card.label}</p>
              <p className="mt-1 text-3xl font-bold text-dark">
                {formatNumber(card.value)}
              </p>
            </div>
            <div className={clsx("rounded-xl p-3", card.bg)}>
              <card.icon className={clsx("h-6 w-6", card.color)} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-dark">
                  Order Highlights
                </h2>
                <p className="text-sm text-muted">
                  Latest breakdown of order statuses
                </p>
              </div>
              <span className="text-sm font-medium text-muted">
                Total: {formatNumber(totalOrders)}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {orderSummaryEntries.length > 0 ? (
                orderSummaryEntries.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-xl border border-accent/10 bg-light p-4"
                  >
                    <p className="text-sm text-muted">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-dark">
                      {formatNumber(item.value)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="col-span-full text-sm text-muted">
                  No order status insights are available yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-dark">
                Recent Orders
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">
                  Last {recentOrders.length} entries
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/admin/orders")}
                >
                  View all
                </Button>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {recentOrders.length > 0 ? (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-accent/10 bg-light p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-dark">
                          Order #{order.id}
                        </p>
                        <p className="text-sm text-muted">
                          {order.customer_name || order.customer_email || "-"}
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                        {formatOrderStatus(order.status_label || order.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
                      <span>{order.service_title || "No service assigned"}</span>
                      <span>•</span>
                      <span>{formatDateTime(order.created_at)}</span>
                      <span>•</span>
                      <span>{formatUsdToRupiah(order.amount)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">
                  No recent orders yet.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-dark">
              Order Activity
            </h2>
            <p className="text-sm text-muted">
              Latest activities related to orders
            </p>
            <div className="mt-4 space-y-4">
              {orderActivities.length > 0 ? (
                displayedOrderActivities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    emphasizeOrder
                  />
                ))
              ) : (
                <p className="text-sm text-muted">
                  No recent order activity yet.
                </p>
              )}
            </div>
            {orderActivities.length > 0 && (
              <PaginationControls
                currentPage={orderActivityPagination.currentPage}
                totalPages={orderActivityPagination.totalPages}
                pageSize={orderActivityPagination.pageSize}
                totalItems={orderActivityPagination.totalItems}
                onPageChange={orderActivityPagination.goToPage}
              />
            )}
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-dark">
            Recent Activity
          </h2>
          <span className="text-sm text-muted">
            Last {activities.length} updates
          </span>
        </div>
        <div className="mt-4 space-y-4">
          {activities.length > 0 ? (
            displayedActivities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))
          ) : (
            <p className="text-sm text-muted">
              No recent activity yet. Updates will appear when services, categories, messages, or orders change.
            </p>
          )}
        </div>
        {activities.length > 0 && (
          <PaginationControls
            currentPage={activityPagination.currentPage}
            totalPages={activityPagination.totalPages}
            pageSize={activityPagination.pageSize}
            totalItems={activityPagination.totalItems}
            onPageChange={activityPagination.goToPage}
          />
        )}
      </section>
    </div>
  );
}

