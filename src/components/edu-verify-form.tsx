"use client";

import Link from "next/link";

import { confirmEduCodeAction, sendEduCodeAction } from "@/app/actions/college";
import { Alert, Button, Field, Input } from "@/components/ui";
import { idleState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

export function EduVerifyForm({
  domain,
  collegeName,
}: {
  domain: string | null;
  collegeName: string;
}) {
  const [sent, sendProps, sending] = useFormAction(sendEduCodeAction, idleState);
  const [confirmed, confirmProps, confirming] = useFormAction(confirmEduCodeAction, idleState);

  if (confirmed.ok) {
    return (
      <div className="space-y-3">
        <Alert tone="success">{confirmed.message}</Alert>
        <Link
          href="/arrive"
          className="inline-flex h-11 items-center rounded-full bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Continue
        </Link>
      </div>
    );
  }

  if (!domain) {
    return (
      <Alert tone="info">
        {collegeName} has no student email domain on file, so it cannot be verified yet.
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <form {...sendProps} className="space-y-3">
        {sent.message && <Alert tone={sent.ok ? "success" : "error"}>{sent.message}</Alert>}
        <Field
          label="Your student email"
          htmlFor="email"
          hint={`Ends in @${domain}. We only use it to prove you belong here.`}
          errors={sent.fieldErrors?.email}
          required
        >
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={`you@${domain}`}
            required
          />
        </Field>
        <Button type="submit" variant={sent.ok ? "secondary" : "primary"} disabled={sending}>
          {sending ? "Sending…" : sent.ok ? "Send a new code" : "Email me a code"}
        </Button>
      </form>

      {sent.ok && (
        <form {...confirmProps} className="space-y-3 border-t border-line pt-5">
          {confirmed.message && <Alert tone="error">{confirmed.message}</Alert>}
          <Field
            label="6-digit code"
            htmlFor="code"
            errors={confirmed.fieldErrors?.code}
            required
          >
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="max-w-[10rem] text-center font-mono text-lg tracking-widest"
              required
            />
          </Field>
          <Button type="submit" disabled={confirming}>
            {confirming ? "Checking…" : "Verify"}
          </Button>
        </form>
      )}
    </div>
  );
}
