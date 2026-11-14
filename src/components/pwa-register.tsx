"use client";

import { useEffect } from "react";

/** Registers the service worker in production so the site can be installed. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is a nicety; never let it surface as an error.
    });
  }, []);

  return null;
}
