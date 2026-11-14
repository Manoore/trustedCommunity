/**
 * The parts of the WhatsApp Cloud API integration that need no network and no
 * secrets, kept apart from the sender so a check script can exercise them.
 */

export type WhatsAppFailure =
  /** The number is not on WhatsApp. */
  | "not_on_whatsapp"
  /** Test mode: the number has not been added to the allowed recipients. */
  | "not_allowed"
  /** Meta is throttling us or this recipient. */
  | "throttled"
  /** Our setup is wrong: token, phone number id or template. Not the user's fault. */
  | "config"
  | "unknown";

/**
 * Body for POST /{phone-number-id}/messages that sends an AUTHENTICATION
 * template. Meta requires the code twice, in the body and in the copy-code
 * button, and the button goes out with sub_type "url" even though the template
 * was created with an OTP button (WhatsApp converts it on approval).
 */
export function buildAuthTemplateBody(input: {
  /** E.164, with or without the leading "+". Meta wants digits only. */
  to: string;
  code: string;
  template: string;
  language: string;
}) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to.replace(/^\+/, ""),
    type: "template",
    template: {
      name: input.template,
      language: { code: input.language },
      components: [
        { type: "body", parameters: [{ type: "text", text: input.code }] },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: input.code }],
        },
      ],
    },
  };
}

const NOT_ON_WHATSAPP = new Set([131026]);
const NOT_ALLOWED = new Set([131030]);
const THROTTLED = new Set([130429, 131048, 131056, 80007, 4, 17, 613]);
const CONFIG = new Set([
  190, // invalid or expired access token
  10, // permission denied
  200, // permissions error
  131008, // required parameter missing
  131009, // parameter value invalid
  132000, // template parameter count mismatch
  132001, // template does not exist in that language
  132005, // translated text too long
  132012, // template parameter format mismatch
  132015, // template paused
  132016, // template disabled
  131037, // display name not approved
  133010, // phone number not registered
]);

/** Turns a Graph API error response into something the app can act on. */
export function classifyWhatsAppError(body: unknown): { reason: WhatsAppFailure; detail: string } {
  const err = (body as { error?: { code?: number; message?: string; error_data?: { details?: string } } })
    ?.error;
  const code = err?.code;
  const detail = [code ? `code ${code}` : null, err?.error_data?.details ?? err?.message]
    .filter(Boolean)
    .join(": ")
    .slice(0, 300);

  if (code !== undefined) {
    if (NOT_ON_WHATSAPP.has(code)) return { reason: "not_on_whatsapp", detail };
    if (NOT_ALLOWED.has(code)) return { reason: "not_allowed", detail };
    if (THROTTLED.has(code)) return { reason: "throttled", detail };
    if (CONFIG.has(code)) return { reason: "config", detail };
  }
  return { reason: "unknown", detail: detail || "no error body" };
}

/** What a person is told. Never the raw Meta message: it can name our internals. */
export function whatsAppFailureMessage(reason: WhatsAppFailure): string {
  switch (reason) {
    case "not_on_whatsapp":
      return "That number does not seem to be on WhatsApp. Check it, or use a number that is.";
    case "not_allowed":
      return "WhatsApp is in test mode on this site, and that number has not been added as a test recipient yet.";
    case "throttled":
      return "WhatsApp is limiting messages to that number right now. Try again in a little while.";
    case "config":
    case "unknown":
      return "We could not send the WhatsApp code just now. Please try again shortly.";
  }
}
