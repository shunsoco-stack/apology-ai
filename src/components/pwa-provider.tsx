"use client";

import { useEffect } from "react";

/** Register only the production app. No form values or history enter the worker. */
export default function PwaProvider() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !window.isSecureContext ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;

    const warmLoadedAssets = () => {
      const worker = navigator.serviceWorker.controller ?? registration?.active;
      if (!worker || disposed) return;

      // The first page can load before its worker controls it. Include those
      // already-loaded chunks and local fonts so its first offline reload works.
      const resources = [
        ...performance.getEntriesByType("resource").map((entry) => entry.name),
        ...Array.from(
          document.querySelectorAll<HTMLScriptElement>("script[src]"),
        ).map((script) => script.src),
        ...Array.from(
          document.querySelectorAll<HTMLLinkElement>("link[href]"),
        ).map((link) => link.href),
      ];
      const urls = [...new Set(resources)].filter((resource) => {
        try {
          const url = new URL(resource, window.location.origin);
          return (
            url.origin === window.location.origin &&
            url.pathname.startsWith("/_next/static/")
          );
        } catch {
          return false;
        }
      });

      worker.postMessage({ type: "CACHE_ASSETS", urls: urls.slice(0, 100) });
    };

    const announceReady = (event: MessageEvent) => {
      if (event.data?.type === "APOLOGY_PWA_READY" && !disposed) {
        window.dispatchEvent(new Event("apology:pwa-ready"));
      }
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await navigator.serviceWorker.ready;
        warmLoadedAssets();
      } catch {
        // Storage policies or private browsing may prohibit a worker. The app
        // still works online, and no permission prompt is needed.
        if (!disposed)
          window.dispatchEvent(new Event("apology:pwa-unavailable"));
      }
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      warmLoadedAssets,
    );
    navigator.serviceWorker.addEventListener("message", announceReady);
    window.addEventListener("load", warmLoadedAssets);
    void register();

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        warmLoadedAssets,
      );
      navigator.serviceWorker.removeEventListener("message", announceReady);
      window.removeEventListener("load", warmLoadedAssets);
    };
  }, []);

  return null;
}
