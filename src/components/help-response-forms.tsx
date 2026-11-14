"use client";

import { useActionState } from "react";
import { completeResponseAction, respondToPostAction } from "@/app/actions/help";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { idleState } from "@/lib/validation";

export function RespondForm({
  postId,
  direction,
}: {
  postId: string;
  direction: "offer" | "need";
}) {
  const [state, formAction, pending] = useActionState(respondToPostAction, idleState);

  if (state.ok) return <Alert tone="success">{state.message}</Alert>;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="postId" value={postId} />
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field
        label={direction === "need" ? "How can you help?" : "Tell them a little about you"}
        htmlFor="message"
        hint={
          direction === "need"
            ? "Which flight can you meet, what can you offer."
            : "Where you are arriving from and when you would need it."
        }
        errors={state.fieldErrors?.message}
        required
      >
        <Textarea id="message" name="message" rows={4} required />
      </Field>

      <Field
        label="Phone (optional)"
        htmlFor="contactPhone"
        hint="Shared only if they accept. Your account email is shared the same way."
        errors={state.fieldErrors?.contactPhone}
      >
        <Input id="contactPhone" name="contactPhone" type="tel" />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : direction === "need" ? "Offer to help" : "Ask for this"}
      </Button>
    </form>
  );
}

export function CompleteForm({ responseId }: { responseId: string }) {
  const [state, formAction, pending] = useActionState(completeResponseAction, idleState);

  if (state.ok) return <Alert tone="success">{state.message}</Alert>;

  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-surface-sunken p-4">
      <input type="hidden" name="responseId" value={responseId} />
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <p className="text-sm font-medium text-ink">Did it happen? Say thanks.</p>
      <Field
        label="A line for the next newcomer (optional)"
        htmlFor={`endorsement-${responseId}`}
        hint="This shows on their profile."
        errors={state.fieldErrors?.endorsement}
      >
        <Textarea
          id={`endorsement-${responseId}`}
          name="endorsement"
          rows={2}
          maxLength={280}
          placeholder="Met me at arrivals with a sign and a SIM card."
        />
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Yes, they helped"}
      </Button>
    </form>
  );
}
