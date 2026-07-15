"use client";

import { useEffect, useRef } from "react";

export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    if (!("wakeLock" in navigator)) return;

    let cancelled = false;

    async function requestLock() {
      try {
        type WakeLockApi = { request: (type: 'screen') => Promise<WakeLockSentinel> };
        const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
        if (!wakeLock) return;
        const lock: WakeLockSentinel = await wakeLock.request("screen");
        if (cancelled) {
          lock.release();
          return;
        }
        lockRef.current = lock;
      } catch (err) {
        console.warn("Wake lock request failed:", err);
      }
    }

    requestLock();

    // iOS/some browsers release the lock when the tab is backgrounded even
    // briefly; re-request it when the page becomes visible again.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !lockRef.current) {
        requestLock();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}