import "server-only";

/**
 * Email, keys-optional.
 *
 * With no RESEND_API_KEY the app still runs and every message is written to the
 * server log instead of being sent, so the whole product is exercisable in
 * development without an account anywhere. Set the key and the same calls start
 * delivering for real.
 */
export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain text. Kept deliberately simple — no HTML templating layer yet. */
  text: string;
};

export function isEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  if (!isEmailEnabled()) {
    console.info(
      `[email:not-configured] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!res.ok) {
      // A failed notification must never fail the user's action.
      console.error(`[email:failed] ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email:error]", error);
    return false;
  }
}

/* --------------------------------------------------------------- messages */

export function connectionRequestEmail(
  to: string,
  fromName: string,
): EmailMessage {
  return {
    to,
    subject: `${fromName} wants to connect on Trusted By`,
    text: [
      `${fromName} would like to connect with you on Trusted By.`,
      "",
      "Connecting means you can see the recommendations each of you has chosen to share with connections.",
      "",
      `Accept or decline: ${siteUrl()}/people`,
    ].join("\n"),
  };
}

export function askBroadcastEmail(
  to: string,
  fromName: string,
  title: string,
  askId: string,
): EmailMessage {
  return {
    to,
    subject: `${fromName} is asking: ${title}`,
    text: [
      `${fromName} asked their network:`,
      "",
      `  "${title}"`,
      "",
      "If you know someone good, you can pass on their details.",
      "",
      `Answer here: ${siteUrl()}/asks/${askId}`,
    ].join("\n"),
  };
}

export function askAnsweredEmail(
  to: string,
  responderName: string,
  contactName: string,
  askId: string,
): EmailMessage {
  return {
    to,
    subject: `${responderName} suggested ${contactName}`,
    text: [
      `${responderName} answered your request with ${contactName}.`,
      "",
      `See the answer: ${siteUrl()}/asks/${askId}`,
    ].join("\n"),
  };
}

export function claimReceivedEmail(to: string, contactName: string): EmailMessage {
  return {
    to,
    subject: `We received your request about ${contactName}`,
    text: [
      `Thanks — we have your request about the profile for ${contactName}.`,
      "",
      "If you asked for removal, the profile is already hidden. An administrator will confirm it shortly.",
      "",
      "You do not need an account with us, and we will not use these details for anything else.",
    ].join("\n"),
  };
}
