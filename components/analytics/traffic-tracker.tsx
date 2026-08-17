"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function TrafficTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    lastPath.current = pathname;
    void fetch("/api/analytics/page-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
