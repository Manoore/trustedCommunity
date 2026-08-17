"use client";

import { useActionState } from "react";
import { sendMessageAction } from "@/app/actions/inquiries";
import { Alert, Button, Textarea } from "@/components/ui";
import { idleState } from "@/lib/validation";

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: Date | string;
  senderName: string;
  senderId: string;
};

export function MessageThread({
  inquiryId,
  messages,
  currentUserId,
  canReply,
  replyHint,
}: {
  inquiryId: string;
  messages: ThreadMessage[];
  currentUserId: string;
  canReply: boolean;
  replyHint?: string;
}) {
  const [state, formAction, pending] = useActionState(sendMessageAction, idleState);

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <li
              key={m.id}
              className={mine ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={[
                  "max-w-[80%] rounded-xl border px-4 py-3 text-sm",
                  mine
                    ? "border-brand-200 bg-brand-50 text-brand-900"
                    : "border-line bg-surface text-ink",
                ].join(" ")}
              >
                <p className="mb-1 text-xs font-medium opacity-70">
                  {mine ? "You" : m.senderName} ·{" "}
                  {new Date(m.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {canReply ? (
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          {state.message && <Alert tone="error">{state.message}</Alert>}
          <label htmlFor="body" className="sr-only">
            Your reply
          </label>
          <Textarea
            id="body"
            name="body"
            rows={4}
            placeholder="Write a reply…"
            required
          />
          {replyHint && <p className="text-xs text-ink-muted">{replyHint}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send reply"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">This conversation is closed.</p>
      )}
    </div>
  );
}
