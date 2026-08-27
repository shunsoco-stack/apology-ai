import { track, type BeforeSendEvent } from "@vercel/analytics";
import { isApologyMode, type ApologyMode } from "@/lib/apology";

const EVENTS = {
  generate: "apology_generate",
  copy: "apology_copy",
  speak: "apology_speak",
  share: "apology_share",
} as const;

export function canTrackAnalytics(): boolean {
  if (process.env.NODE_ENV !== "production" || typeof window === "undefined")
    return false;
  try {
    const privacyNavigator = navigator as Navigator & {
      globalPrivacyControl?: boolean;
      msDoNotTrack?: string;
    };
    const privacyWindow = window as Window & { doNotTrack?: string };
    const preferences = [
      navigator.doNotTrack,
      privacyNavigator.msDoNotTrack,
      privacyWindow.doNotTrack,
    ];
    return (
      privacyNavigator.globalPrivacyControl !== true &&
      !preferences.some((value) => value === "1" || value === "yes")
    );
  } catch {
    return false;
  }
}

/** Never accepts situation text, a recipient, or severity. */
export function trackApology(
  event: keyof typeof EVENTS,
  mode: ApologyMode,
): void {
  if (
    !canTrackAnalytics() ||
    !Object.hasOwn(EVENTS, event) ||
    !isApologyMode(mode)
  )
    return;
  try {
    track(EVENTS[event], { mode });
  } catch {
    // Analytics is optional: blocked requests must never interrupt an apology.
  }
}

/** Strip query strings and fragments from both page views and custom events. */
export function sanitizeAnalyticsEvent(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  if (!canTrackAnalytics()) return null;
  try {
    const url = new URL(event.url, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return { ...event, url: `${url.origin}${url.pathname}` };
  } catch {
    return null;
  }
}
