"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createInquiryAction } from "@/app/actions/inquiries";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { idleState } from "@/lib/validation";

export function InquiryForm({
  listingId,
  listingSlug,
  providerName,
  signedIn,
  defaults,
}: {
  listingId: string;
  listingSlug: string;
  providerName: string;
  signedIn: boolean;
  defaults?: { name?: string; email?: string; phone?: string };
}) {
  const [state, formAction, pending] = useActionState(createInquiryAction, idleState);

  if (!signedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">
          Sign in to message {providerName}. Your contact details are shared with them
          only — never published on the listing.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/listings/${listingSlug}#contact`)}`}
          className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          Sign in to send an inquiry
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="listingSlug" value={listingSlug} />

      {state.message && <Alert tone="error">{state.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" errors={state.fieldErrors?.name} required>
          <Input id="name" name="name" defaultValue={defaults?.name} required />
        </Field>
        <Field label="Email" htmlFor="email" errors={state.fieldErrors?.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaults?.email}
            required
          />
        </Field>
        <Field label="Phone" htmlFor="phone" errors={state.fieldErrors?.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={defaults?.phone} />
        </Field>
        <Field label="Your ZIP" htmlFor="zip" errors={state.fieldErrors?.zip}>
          <Input id="zip" name="zip" inputMode="numeric" placeholder="75201" />
        </Field>
      </div>

      <Field
        label="What do you need?"
        htmlFor="message"
        errors={state.fieldErrors?.message}
        hint="Describe the job, timing, and anything that affects the price."
        required
      >
        <Textarea id="message" name="message" rows={5} required />
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send inquiry"}
      </Button>

      <p className="text-xs text-ink-muted">
        {providerName} sees your name, email, and phone so they can quote the job. Their
        details unlock for you as soon as they reply.
      </p>
    </form>
  );
}
