/*
 * Minimal service worker.
 *
 * Its job is to make the site installable and to fail gracefully offline. It
 * deliberately caches NOTHING: pages here are personal and permission-checked,
 * and a cached copy of someone's list, or of a page that was visible to them a
 * minute ago, is exactly what must not be served to a later session.
 */
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>
<style>body{font-family:system-ui,sans-serif;background:#fbf8f4;color:#1c1a17;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}
h1{font-size:1.4rem}p{color:#6b6459}</style></head>
<body><div><h1>You are offline</h1><p>Trusted By needs a connection to show your list. Try again when you are back online.</p></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
    ),
  );
});
