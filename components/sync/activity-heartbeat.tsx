"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_EVENT_THROTTLE_MS = 10_000;

function isClientTabActive(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  return document.visibilityState === "visible" && document.hasFocus() && window.navigator.onLine;
}

export function ActivityHeartbeat() {
  const requestActiveClientSync = useMutation(api.sync.requestActiveClientSync);
  const lastSentAtRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let isUnmounted = false;

    const sendHeartbeat = (source: string) => {
      if (isUnmounted || !isClientTabActive()) return;
      if (inFlightRef.current) return;

      const now = Date.now();
      if (now - lastSentAtRef.current < HEARTBEAT_EVENT_THROTTLE_MS) return;

      inFlightRef.current = true;
      lastSentAtRef.current = now;

      void requestActiveClientSync({ source })
        .catch(() => {
          // Ignore transient connectivity failures; the next active heartbeat retries.
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat("visibility");
      }
    };

    const onFocus = () => sendHeartbeat("focus");
    const onOnline = () => sendHeartbeat("online");

    const intervalId = window.setInterval(() => sendHeartbeat("interval"), HEARTBEAT_INTERVAL_MS);
    sendHeartbeat("mount");

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      isUnmounted = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [requestActiveClientSync]);

  return null;
}
