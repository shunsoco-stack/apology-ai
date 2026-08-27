"use client";

import { Analytics } from "@vercel/analytics/react";
import { useSyncExternalStore } from "react";
import { canTrackAnalytics, sanitizeAnalyticsEvent } from "@/lib/analytics";

function subscribe(notify: () => void) {
  window.addEventListener("focus", notify);
  document.addEventListener("visibilitychange", notify);
  return () => {
    window.removeEventListener("focus", notify);
    document.removeEventListener("visibilitychange", notify);
  };
}

export default function AnalyticsProvider() {
  const enabled = useSyncExternalStore(
    subscribe,
    canTrackAnalytics,
    () => false,
  );
  if (!enabled) return null;
  return (
    <Analytics
      mode="production"
      debug={false}
      beforeSend={sanitizeAnalyticsEvent}
    />
  );
}
