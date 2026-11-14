import "server-only";

import {
  buildAuthTemplateBody,
  classifyWhatsAppError,
  type WhatsAppFailure,
} from "@/lib/whatsapp-format";

/**
 * Sends one-time codes over the WhatsApp Business Platform (Cloud API).
 *
 * Needs a Meta app with a WhatsApp number and an approved AUTHENTICATION
 * template. With the variables below unset the site simply reports WhatsApp as
 * off, and in development the code is shown on screen instead, so nothing here
 * blocks working on the rest of the app.
 *
 *   WHATSAPP_ACCESS_TOKEN       system-user token (a long-lived one, not the 24h test token)
 *   WHATSAPP_PHONE_NUMBER_ID    the sending number's id (not the number itself)
 *   WHATSAPP_TEMPLATE_NAME      the approved authentication template
 *   WHATSAPP_TEMPLATE_LANGUAGE  the template's language code (default en_US)
 *   WHATSAPP_API_VERSION        Graph API version (default v23.0)
 */
export function isWhatsAppEnabled() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_TEMPLATE_NAME,
  );
}

export type SendResult = { ok: true } | { ok: false; reason: WhatsAppFailure; detail: string };

export async function sendWhatsAppCode(e164: string, code: string): Promise<SendResult> {
  if (!isWhatsAppEnabled()) {
    return { ok: false, reason: "config", detail: "WhatsApp is not configured" };
  }

  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  // WHATSAPP_API_BASE exists so a check can point this at a local stand-in for Meta.
  const base = process.env.WHATSAPP_API_BASE || "https://graph.facebook.com";
  const url = `${base}/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = buildAuthTemplateBody({
    to: e164,
    code,
    template: process.env.WHATSAPP_TEMPLATE_NAME!,
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US",
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) return { ok: true };

    const failure = classifyWhatsAppError(await res.json().catch(() => null));
    // Log the reason for whoever runs the site. Never the code or the token.
    console.error(`[whatsapp] send failed (${res.status}) ${failure.reason}: ${failure.detail}`);
    return { ok: false, ...failure };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "network error";
    console.error(`[whatsapp] send failed: ${detail}`);
    return { ok: false, reason: "unknown", detail };
  }
}
