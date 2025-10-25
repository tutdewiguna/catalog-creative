"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ANALYTICS_ENDPOINT = `${API_BASE}/api/analytics/events`;
const VISITOR_STORAGE_KEY = "td_analytics_visitor";
const SESSION_STORAGE_KEY = "td_analytics_session";
const SESSION_TIMEOUT_MINUTES = 30;

type EventPayload = {
  event_type: string;
  event_name?: string;
  page_path?: string;
  page_title?: string;
  referrer?: string;
  country?: string;
  city?: string;
  device?: string;
  browser?: string;
  os?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  metadata?: Record<string, string>;
  occurred_at?: string;
};

const getNavigatorInfo = () => {
  if (typeof navigator === "undefined") {
    return {};
  }
  const ua = navigator.userAgent.toLowerCase();
  let os = "";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "Mac OS";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("linux")) os = "Linux";

  let browser = "";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("safari")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";

  const device =
    /mobile|iphone|ipad|android/.test(ua) ? "mobile" : "desktop";

  return { os, browser, device };
};

const ensureVisitorId = () => {
  if (typeof window === "undefined") return "";
  let visitorId = localStorage.getItem(VISITOR_STORAGE_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  }
  return visitorId;
};

const ensureSessionId = () => {
  if (typeof window === "undefined") return "";
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { id: string; refreshed: number };
      if (
        parsed?.id &&
        Date.now() - parsed.refreshed <
          SESSION_TIMEOUT_MINUTES * 60 * 1000
      ) {
        parsed.refreshed = Date.now();
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
        return parsed.id;
      }
    }
  } catch {
    // ignore parse errors
  }
  const newId = `s_${crypto.randomUUID()}`;
  sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ id: newId, refreshed: Date.now() })
  );
  return newId;
};

const extractUTMParams = () => {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || undefined,
    utm_medium: params.get("utm_medium") || undefined,
    utm_campaign: params.get("utm_campaign") || undefined,
    utm_term: params.get("utm_term") || undefined,
    utm_content: params.get("utm_content") || undefined,
  };
};

const guessCountry = () => {
  if (typeof navigator === "undefined") return undefined;
  const locale =
    navigator.languages?.[0] || navigator.language || navigator.language;
  if (!locale) return undefined;
  const parts = locale.split("-");
  if (parts.length > 1) {
    return parts[parts.length - 1].toUpperCase();
  }
  return undefined;
};

const sendEventToServer = (base: EventPayload) => {
  if (typeof window === "undefined") return;
  const visitorId = ensureVisitorId();
  const sessionId = ensureSessionId();

  const payload = {
    ...base,
    session_id: sessionId,
    visitor_id: visitorId,
    page_path: base.page_path || window.location.pathname,
    page_title: base.page_title || document.title,
    referrer: base.referrer ?? document.referrer ?? "",
    country: base.country || guessCountry() || "",
    occurred_at: base.occurred_at || new Date().toISOString(),
    metadata: {
      ...(base.metadata || {}),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      screen: `${window.screen.width}x${window.screen.height}`,
    },
    ...extractUTMParams(),
    ...getNavigatorInfo(),
  };

  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
    return;
  }

  fetch(ANALYTICS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // swallow network errors
  });
};

const pushToDataLayer = (event: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push(event);
};

export const trackInteraction = (
  eventName: string,
  metadata?: Record<string, string>
) => {
  const payload: EventPayload = {
    event_type: "interaction",
    event_name: eventName,
    metadata,
  };
  pushToDataLayer({
    event: "interaction",
    event_name: eventName,
    ...metadata,
  });
  sendEventToServer(payload);
};

const trackPageView = () => {
  const payload: EventPayload = {
    event_type: "page_view",
    event_name: "page_view",
  };
  pushToDataLayer({
    event: "page_view",
    page_path: typeof window !== "undefined" ? window.location.pathname : "",
  });
  sendEventToServer(payload);
};

const handleClickEvent = (event: MouseEvent) => {
  let target = event.target as HTMLElement | null;
  if (!target) return;
  const trackable = target.closest("[data-track-click]") as
    | HTMLElement
    | null;
  if (!trackable) return;
  const action =
    trackable.dataset.trackClick || trackable.textContent?.trim() || "click";
  const label = trackable.dataset.trackLabel || trackable.id || "";
  trackInteraction(action, { label });
};

type AnalyticsOptions = {
  disabled?: boolean;
};

export const useAnalyticsTracker = (options?: AnalyticsOptions) => {
  const disabled = options?.disabled;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;
    ensureVisitorId();
    ensureSessionId();

    if (!initializedRef.current) {
      initializedRef.current = true;
      document.addEventListener("click", handleClickEvent, true);
      window.addEventListener("beforeunload", () => {
        ensureSessionId();
      });
    }

    trackPageView();

    return () => {
      // event listener removed in unmount of layout
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, disabled]);

  useEffect(() => {
    if (disabled) return;
    return () => {
      document.removeEventListener("click", handleClickEvent, true);
    };
  }, [disabled]);
};
