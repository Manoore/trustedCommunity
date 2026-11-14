"use client";


import { claimBusinessAction } from "@/app/actions/business";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { idleState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

export function ClaimBusinessForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, formProps, pending] = useFormAction(claimBusinessAction, idleState);

  return (
    <form {...formProps} className="space-y-4">
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field label="Business name" htmlFor="name" errors={state.fieldErrors?.name} required>
        <Input id="name" name="name" placeholder="Mike's Plumbing" required />
      </Field>

      <Field
        label="Phone number"
        htmlFor="phone"
        hint="This is your listing's identity — one profile per number."
        errors={state.fieldErrors?.phone}
        required
      >
        <Input id="phone" name="phone" type="tel" placeholder="(937) 555-0148" required />
      </Field>

      <Field
        label="Headline"
        htmlFor="headline"
        hint="One line under your name."
        errors={state.fieldErrors?.headline}
      >
        <Input
          id="headline"
          name="headline"
          maxLength={160}
          placeholder="Licensed plumber, 15 years in Dayton"
        />
      </Field>

      <Field
        label="About your business"
        htmlFor="bio"
        hint="What you do and who you do it for."
        errors={state.fieldErrors?.bio}
        required
      >
        <Textarea id="bio" name="bio" rows={5} required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website" htmlFor="websiteUrl" errors={state.fieldErrors?.websiteUrl}>
          <Input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://" />
        </Field>
        <Field label="ZIP code" htmlFor="zip" errors={state.fieldErrors?.zip}>
          <Input id="zip" name="zip" inputMode="numeric" maxLength={5} />
        </Field>
      </div>

      <Field
        label="Contact email"
        htmlFor="contactEmail"
        hint="Defaults to your account email if left blank."
        errors={state.fieldErrors?.contactEmail}
      >
        <Input id="contactEmail" name="contactEmail" type="email" defaultValue={defaultEmail} />
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Listing…" : "List my business"}
      </Button>

      <p className="text-xs text-ink-muted">
        This creates your profile with zero recommendations. Real trust comes from
        customers vouching for you — share your page and ask them to.
      </p>
    </form>
  );
}
