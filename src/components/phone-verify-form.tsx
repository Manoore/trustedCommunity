"use client";

import Link from "next/link";

import { confirmPhoneCodeAction, sendPhoneCodeAction } from "@/app/actions/phone";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { COUNTRIES } from "@/lib/countries";
import { useFormAction } from "@/lib/use-form-action";
import { idleState } from "@/lib/validation";

export function PhoneVerifyForm({ next }: { next: string }) {
  const [sent, sendProps, sending] = useFormAction(sendPhoneCodeAction, idleState);
  const [confirmed, confirmProps, confirming] = useFormAction(confirmPhoneCodeAction, idleState);

  if (confirmed.ok) {
    return (
      <div className="space-y-3">
        <Alert tone="success">{confirmed.message}</Alert>
        <Link
          href={next}
          className="inline-flex h-11 items-center rounded-full bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Continue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form {...sendProps} className="space-y-3">
        {sent.message && <Alert tone={sent.ok ? "success" : "error"}>{sent.message}</Alert>}

        <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
          <Field label="Country" htmlFor="country">
            <Select id="country" name="country" defaultValue="US">
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="WhatsApp number"
            htmlFor="phone"
            hint="The number you use on WhatsApp. It is never shown to anyone."
            errors={sent.fieldErrors?.phone}
            required
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(937) 555-0148"
              required
            />
          </Field>
        </div>

        <Button type="submit" variant={sent.ok ? "secondary" : "primary"} disabled={sending}>
          {sending ? "Sending…" : sent.ok ? "Send a new code" : "Send my code on WhatsApp"}
        </Button>
      </form>

      {sent.ok && (
        <form {...confirmProps} className="space-y-3 border-t border-line pt-5">
          {confirmed.message && <Alert tone="error">{confirmed.message}</Alert>}
          <Field label="6-digit code" htmlFor="code" errors={confirmed.fieldErrors?.code} required>
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
