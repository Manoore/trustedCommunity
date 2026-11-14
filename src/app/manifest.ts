import type { MetadataRoute } from "next";

/**
 * Makes the site installable to a phone's home screen, and registers it as a
 * share target. Communities live in WhatsApp, so "share this contact to Trusted
 * By" has to be one tap from the chat it was shared in, not a copy-and-paste.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trusted By",
    short_name: "Trusted By",
    description: "The people you trust, recommending the people you need.",
    start_url: "/list",
    scope: "/",
    display: "standalone",
    background_color: "#fbf8f4",
    theme_color: "#12866f",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/import",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  } as MetadataRoute.Manifest;
}
