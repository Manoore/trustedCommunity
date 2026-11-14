import "server-only";

import { headers } from "next/headers";

/**
 * The origin the current visitor is actually using, e.g. https://app.vercel.app.
 *
 * Links shown in the UI (group invites, share links) have to work from wherever
 * the app is served. Reading NEXT_PUBLIC_SITE_URL alone means an unset variable
 * on a fresh deploy renders `http://localhost:3000` links that nobody else can
 * open. The request's own host is always right for a link the visitor is about
 * to copy, so prefer it and fall back to the env var only outside a request.
 */
export async function getOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Not inside a request - fall through to the configured URL.
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
