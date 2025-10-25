"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getAnalyticsSummary, getAnalyticsEvents } from "@/lib/api";
import { Activity, BarChart3, Clock, Download, Users } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
  Legend,
  BarChart as RechartBarChart,
  Bar,
} from "recharts";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";

const RANGE_OPTIONS = [
  { label: "24 Hours", value: "24h" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
];

const formatNumber = (value?: number) =>
  new Intl.NumberFormat("en-US").format(value ?? 0);

const formatDuration = (seconds?: number) => {
  if (!seconds || Number.isNaN(seconds)) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const relativeTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
};

interface AnalyticsEvent {
  id: number;
  session_id: string;
  visitor_id: string;
  event_type: string;
  event_name: string;
  page_path: string;
  page_title?: string;
  referrer?: string;
  country?: string;
  occurred_at: string;
  metadata?: Record<string, string>;
}

interface AnalyticsTimeseriesPoint {
  bucket: string;
  visitors: number;
  sessions: number;
  page_views: number;
  interactions: number;
}

interface AnalyticsSourceStat {
  source: string;
  medium?: string;
  campaign?: string;
  count: number;
}

interface AnalyticsPageStat {
  page_path: string;
  views: number;
  uniques: number;
}

interface AnalyticsFlowStat {
  from: string;
  to: string;
  count: number;
}

interface AnalyticsInteractionStat {
  event_name: string;
  event_type: string;
  count: number;
}

interface AnalyticsSummary {
  range_start: string;
  range_end: string;
  total_visitors: number;
  unique_visitors: number;
  total_sessions: number;
  total_page_views: number;
  total_events: number;
  average_session_duration: number;
  timeseries: AnalyticsTimeseriesPoint[];
  source_breakdown: AnalyticsSourceStat[];
  top_pages: AnalyticsPageStat[];
  page_flows: AnalyticsFlowStat[];
  interaction_breakdown: AnalyticsInteractionStat[];
  recent_events: AnalyticsEvent[];
}

export default function AnalyticsDashboardPage() {
  const [range, setRange] = useState("7d");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const [summaryResp, eventsResp] = await Promise.all([
          getAnalyticsSummary({ range }),
          getAnalyticsEvents({ range, limit: 40 }),
        ]);
        if (!active) return;
        const normalisedSummary: AnalyticsSummary = {
          ...summaryResp,
          timeseries: summaryResp?.timeseries ?? [],
          source_breakdown: summaryResp?.source_breakdown ?? [],
          top_pages: summaryResp?.top_pages ?? [],
          page_flows: summaryResp?.page_flows ?? [],
          interaction_breakdown: summaryResp?.interaction_breakdown ?? [],
          recent_events: summaryResp?.recent_events ?? [],
        };
        setSummary(normalisedSummary);
        setEvents(eventsResp ?? []);
      } catch (error) {
        console.error("Failed to load analytics", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchAnalytics();
    const interval = window.setInterval(fetchAnalytics, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [range]);

  const timeseries = summary?.timeseries ?? [];
  const chartData = useMemo(
    () =>
      timeseries.map((point) => ({
        bucket: point.bucket,
        visitors: point.visitors,
        sessions: point.sessions,
        interactions: point.interactions,
      })),
    [timeseries]
  );

  const sourceChartData = useMemo(
    () =>
      (summary?.source_breakdown ?? []).map((item) => ({
        source: item.source || "Direct",
        medium: item.medium || "direct",
        count: item.count,
      })),
    [summary?.source_breakdown]
  );

  const topPages = summary?.top_pages ?? [];
  const pageFlows = summary?.page_flows ?? [];
  const topPagesPagination = usePagination(topPages, 10);
  const pageFlowsPagination = usePagination(pageFlows, 10);
  const eventsPagination = usePagination(events, 10);
  const displayedTopPages = topPagesPagination.paginatedItems;
  const displayedPageFlows = pageFlowsPagination.paginatedItems;
  const displayedEvents = eventsPagination.paginatedItems;

  const handleExportCSV = () => {
    if (!events.length) return;

    const rows = [
      [
        "timestamp",
        "relative_time",
        "event_type",
        "event_name",
        "page_path",
        "referrer",
        "country",
        "session_id",
        "visitor_id",
      ],
      ...events.map((event) => [
        formatDateTime(event.occurred_at),
        relativeTime(event.occurred_at),
        event.event_type,
        event.event_name,
        event.page_path,
        event.referrer || "",
        event.country || "",
        event.session_id,
        event.visitor_id,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = cell ?? "";
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-events-${new Date()
      .toISOString()
      .slice(0, 19)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { name: string; value: number }[];
    label?: string;
  }) => {
    if (!active || !payload || payload.length === 0) {
      return null;
    }
    return (
      <div className="rounded-lg border border-accent/15 bg-white/95 px-4 py-2 shadow-sm">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <ul className="mt-1 space-y-1 text-xs text-muted">
          {payload.map((item) => (
            <li key={item.name} className="flex justify-between gap-4">
              <span className="capitalize">{item.name}</span>
              <span className="font-semibold text-dark">
                {formatNumber(item.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-dark">
            Analytics Overview
          </h1>
          <p className="text-sm text-muted">
            Monitor visitor performance and interactions in real time.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-accent/15 bg-white p-1 shadow-sm">
          {RANGE_OPTIONS.map((option) => {
            const isActive = range === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition ${
                  isActive
                    ? "bg-primary text-dark shadow-sm"
                    : "text-muted hover:bg-accent/10 hover:text-primary"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnalyticsStatCard
          icon={<Users className="w-5 h-5" />}
          title="Total Visitors"
          subtitle="Page views within the selected range"
          value={formatNumber(summary?.total_visitors)}
          loading={loading}
        />
        <AnalyticsStatCard
          icon={<Activity className="w-5 h-5" />}
          title="Unique Visitors"
          subtitle="Distinct visitor IDs"
          value={formatNumber(summary?.unique_visitors)}
          loading={loading}
        />
        <AnalyticsStatCard
          icon={<BarChart3 className="w-5 h-5" />}
          title="Total Sessions"
          subtitle="Active sessions in the period"
          value={formatNumber(summary?.total_sessions)}
          loading={loading}
        />
        <AnalyticsStatCard
          icon={<Clock className="w-5 h-5" />}
          title="Average Duration"
          subtitle="Per session (minutes/seconds)"
          value={formatDuration(summary?.average_session_duration)}
          loading={loading}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark">
              Visitor & Session Trends
            </h2>
            <span className="text-xs text-muted">
              {timeseries.length} data point
            </span>
          </div>
          <div className="mt-6 h-72">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dfe3ea" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartTooltip content={renderTooltip} />
                  <Legend />
                  <Area
                    type="monotone"
                    name="Visitors"
                    dataKey="visitors"
                    stroke="#1e3d59"
                    strokeWidth={2}
                    fill="#1e3d59"
                    fillOpacity={0.18}
                  />
                  <Area
                    type="monotone"
                    name="Sessions"
                    dataKey="sessions"
                    stroke="#d4af37"
                    strokeWidth={2}
                    fill="#d4af37"
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    name="Interactions"
                    dataKey="interactions"
                    stroke="#f5d7b2"
                    strokeWidth={2}
                    fill="#f5d7b2"
                    fillOpacity={0.12}
                    strokeDasharray="4 3"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl bg-light text-sm text-muted">
                No analytics data is available for this range.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm space-y-4">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold text-dark">
              Top Traffic Sources
            </h2>
            <span className="text-xs text-muted">
              {(summary?.source_breakdown ?? []).length} sources
            </span>
          </div>
          {sourceChartData.length > 0 ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <RechartBarChart
                  data={sourceChartData}
                  layout="vertical"
                  margin={{ left: 0, top: 5, right: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#dfe3ea" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="source"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={110}
                  />
                  <RechartTooltip content={renderTooltip} />
                  <Bar
                    dataKey="count"
                    name="Visits"
                    fill="#d4af37"
                    radius={[6, 6, 6, 6]}
                  />
                </RechartBarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted">
              No traffic source data yet.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-dark">
            Top Pages
          </h2>
          <p className="text-sm text-muted">
            Sorted by total views.
          </p>
          <div className="mt-4 space-y-3">
            {topPages.length > 0 ? (
              displayedTopPages.map((page) => (
                <div
                  key={page.page_path}
                  className="rounded-xl border border-accent/10 bg-light/70 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-dark">
                    {page.page_path}
                  </p>
                  <div className="mt-1 flex items-center gap-4 text-xs text-muted">
                    <span>{formatNumber(page.views)} views</span>
                    <span>{formatNumber(page.uniques)} unique</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">
                No pages were visited in this range.
              </p>
            )}
          </div>
          {topPages.length > 0 && (
            <PaginationControls
              currentPage={topPagesPagination.currentPage}
              totalPages={topPagesPagination.totalPages}
              pageSize={topPagesPagination.pageSize}
              totalItems={topPagesPagination.totalItems}
              onPageChange={topPagesPagination.goToPage}
            />
          )}
        </div>

        <div className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-dark">
            Top Interactions
          </h2>
          <p className="text-sm text-muted">
            Button clicks, actions, and other key interactions.
          </p>
          {(summary?.interaction_breakdown ?? []).length > 0 ? (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartBarChart
                  data={summary?.interaction_breakdown ?? []}
                  margin={{ top: 8, right: 10, left: 0, bottom: 36 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#dfe3ea" />
                  <XAxis
                    dataKey="event_name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartTooltip content={renderTooltip} />
                  <Bar
                    dataKey="count"
                    name="Count"
                    fill="#f5d7b2"
                    radius={[6, 6, 0, 0]}
                  />
                </RechartBarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              No interactions have been recorded yet.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-dark">
          Popular Visit Paths
        </h2>
        <p className="text-sm text-muted">
          From page to page within a single session.
        </p>
        <div className="mt-4 space-y-3">
          {pageFlows.length > 0 ? (
            displayedPageFlows.map((flow) => (
              <div
                key={`${flow.from}-${flow.to}`}
                className="flex items-center justify-between rounded-xl border border-accent/10 bg-light px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-dark">
                    {flow.from || "(start)"}
                  </p>
                  <p className="text-xs text-muted">→ {flow.to || "(exit)"}</p>
                </div>
                <span className="text-sm font-semibold text-muted">
                  {formatNumber(flow.count)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">
              No visit path data yet.
            </p>
          )}
        </div>
        {pageFlows.length > 0 && (
          <PaginationControls
            currentPage={pageFlowsPagination.currentPage}
            totalPages={pageFlowsPagination.totalPages}
            pageSize={pageFlowsPagination.pageSize}
            totalItems={pageFlowsPagination.totalItems}
            onPageChange={pageFlowsPagination.goToPage}
          />
        )}
      </section>

      <section className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-dark">
              Latest Activity
            </h2>
            <p className="text-sm text-muted">
              Real-time updates from GTM
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              {events.length} recent events
            </span>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 rounded-full border border-accent/15 px-4 py-2 text-xs font-medium text-muted transition hover:border-primary/40 hover:text-primary"
              disabled={!events.length}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-accent/15 text-sm">
            <thead className="bg-light">
              <tr className="text-left text-xs font-semibold uppercase text-muted">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Page</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Country</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {events.length > 0 ? (
                displayedEvents.map((event) => (
                  <tr key={`${event.id}-${event.occurred_at}`} className="text-muted">
                    <td className="px-4 py-3">
                      <p className="font-medium">{relativeTime(event.occurred_at)}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(event.occurred_at)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold capitalize">
                        {event.event_name || event.event_type}
                      </p>
                      <p className="text-xs text-muted">{event.event_type}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {event.page_path || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {event.referrer || event.metadata?.utm_source || "Direct"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {event.country || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-muted" colSpan={5}>
                    No events have been recorded for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {events.length > 0 && (
          <PaginationControls
            currentPage={eventsPagination.currentPage}
            totalPages={eventsPagination.totalPages}
            pageSize={eventsPagination.pageSize}
            totalItems={eventsPagination.totalItems}
            onPageChange={eventsPagination.goToPage}
          />
        )}
      </section>
    </div>
  );
}

function AnalyticsStatCard({
  icon,
  title,
  subtitle,
  value,
  loading,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-accent/15 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-muted">{title}</p>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      <p className="mt-6 text-2xl font-bold text-dark">
        {loading ? "…" : value}
      </p>
    </div>
  );
}





