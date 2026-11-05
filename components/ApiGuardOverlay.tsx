"use client";

import { useEffect } from "react";
import { subscribeApiGuardEvents } from "@/lib/api-guard/client";

/**
 * Root-level event listener. It intentionally renders nothing so the regular
 * application UI remains unchanged while API Guard is enabled.
 */
export default function ApiGuardOverlay(): null {
  useEffect(() => {
    return subscribeApiGuardEvents((event) => {
      if (event.type !== "state") return;

      window.dispatchEvent(
        new CustomEvent(
          event.state.enabled ? "api-guard:enabled" : "api-guard:disabled",
          { detail: event.state },
        ),
      );
    });
  }, []);

  return null;
}
