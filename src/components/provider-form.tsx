"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { idleState, type ActionState } from "@/lib/validation";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type ProviderDefaults = {
  id?: string;
  type?: "individual" | "entity";
  displayName?: string;
  legalName?: string | null;
  headline?: string | null;
  bio?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  zip?: string | null;
  yearsExperience?: number | null;
};

export function ProviderForm({
  action,
  defaults,
  submitLabel,
}: {
  action: Action;
  defaults?: ProviderDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const [type, setType] = useState<"individual" | "entity">(
    defaults?.type ?? "individual",
  );

  return (
    <form action={formAction} className="space-y-6">
      {defaults?.id && <input type="hidden" name="providerId" value={defaults.id} />}

      {state.message && (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      )}

      <Card>
        <h2 className="font-semibold text-ink">How are you listing?</h2>
        <p className="mt-1 text-sm text-ink-muted">
          This changes what we ask for and whether you can add team members later.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "individual",
                title: "As an individual",
                blurb:
                  "You do the work yourself. Sole proprietors and freelancers belong here.",
              },
              {
                value: "entity",
                title: "As a business",
                blurb:
                  "An LLC, corporation, or partnership. Adds team seats and a legal name on file.",
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={[
                "cursor-pointer rounded-xl border p-4 transition-colors",
                type === option.value
                  ? "border-brand-500 bg-brand-50"
                  : "border-line-strong hover:bg-surface-sunken",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value={option.value}
                  checked={type === option.value}
                  onChange={() => setType(option.value)}
                  className="h-4 w-4"
                />
                <span className="font-medium text-ink">{option.title}</span>
              </span>
              <span className="mt-1 block text-sm text-ink-muted">{option.blurb}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-ink">Public profile</h2>

        <Field
          label={type === "entity" ? "Business name buyers see" : "Your name"}
          htmlFor="displayName"
          errors={state.fieldErrors?.displayName}
          required
        >
          <Input
            id="displayName"
            name="displayName"
            defaultValue={defaults?.displayName}
            required
          />
        </Field>

        {type === "entity" && (
          <Field
            label="Registered legal name"
            htmlFor="legalName"
            hint="As filed with your state. Shown on your profile for transparency."
            errors={state.fieldErrors?.legalName}
            required
          >
            <Input
              id="legalName"
              name="legalName"
              defaultValue={defaults?.legalName ?? ""}
            />
          </Field>
        )}

        <Field
          label="Headline"
          htmlFor="headline"
          hint="One line. Shows under your name in search."
          errors={state.fieldErrors?.headline}
        >
          <Input
            id="headline"
            name="headline"
            maxLength={160}
            placeholder="Licensed electrician serving the north metro"
            defaultValue={defaults?.headline ?? ""}
          />
        </Field>

        <Field
          label="About"
          htmlFor="bio"
          hint="What you do, who you do it for, and what makes your quote different."
          errors={state.fieldErrors?.bio}
          required
        >
          <Textarea id="bio" name="bio" rows={6} defaultValue={defaults?.bio ?? ""} required />
        </Field>

        <Field
          label="Years of experience"
          htmlFor="yearsExperience"
          errors={state.fieldErrors?.yearsExperience}
        >
          <Input
            id="yearsExperience"
            name="yearsExperience"
            type="number"
            min={0}
            max={80}
            defaultValue={defaults?.yearsExperience ?? ""}
          />
        </Field>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Contact details</h2>
          <p className="mt-1 text-sm text-ink-muted">
            These stay masked on your public listing. Buyers see them only after you
            reply to their inquiry.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Contact email"
            htmlFor="contactEmail"
            errors={state.fieldErrors?.contactEmail}
            required
          >
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={defaults?.contactEmail ?? ""}
              required
            />
          </Field>

          <Field
            label="Contact phone"
            htmlFor="contactPhone"
            errors={state.fieldErrors?.contactPhone}
          >
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              defaultValue={defaults?.contactPhone ?? ""}
            />
          </Field>

          <Field
            label="Website"
            htmlFor="websiteUrl"
            errors={state.fieldErrors?.websiteUrl}
          >
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              placeholder="https://"
              defaultValue={defaults?.websiteUrl ?? ""}
            />
          </Field>

          <Field
            label="Base ZIP code"
            htmlFor="zip"
            hint="Where you work from. Drives distance in search."
            errors={state.fieldErrors?.zip}
            required
          >
            <Input
              id="zip"
              name="zip"
              inputMode="numeric"
              maxLength={5}
              defaultValue={defaults?.zip ?? ""}
              required
            />
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <p className="text-xs text-ink-muted">
          By listing, you confirm you are an independent business and hold any licence
          your trade requires.
        </p>
      </div>
    </form>
  );
}
