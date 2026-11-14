"use client";

import { useState } from "react";

/**
 * Where communities actually talk is WhatsApp and text threads, so the share
 * actions lead with those. A link that cannot be pasted into a group chat in
 * one tap is a link that never gets shared.
 */
export function ShareBar({
  url,
  text,
  label = "Send it",
}: {
  url: string;
  /** Message that precedes the link in the chat. */
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const message = `${text} ${url}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const sms = `sms:?&body=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context, permissions). Fall back to
      // selecting the text so the user can copy by hand.
      window.prompt("Copy this link:", url);
    }
  }

  const chip =
    "inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken";

  return (
    <div className="space-y-3">
      <p className="break-all rounded-xl bg-surface-sunken px-4 py-3 font-mono text-sm text-ink">
        {url}
      </p>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25d366] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <span aria-hidden="true">💬</span> WhatsApp
        </a>
        <a href={sms} className={chip}>
          <span aria-hidden="true">✉️</span> Text message
        </a>
        <button type="button" onClick={copy} className={chip}>
          <span aria-hidden="true">{copied ? "✅" : "🔗"}</span>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
