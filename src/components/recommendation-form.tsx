"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { CategoryGroup } from "@/components/listing-form";
import { COUNTRIES } from "@/lib/countries";
import {
  IMMIGRATION_WARNING,
  PROFESSIONAL_DISCLAIMER,
  PROFESSIONAL_NOTE_LIMIT,
  PROFESSIONAL_NOTE_WARNING,
} from "@/lib/professional";
import {
  RELATIONSHIP_LABELS,
  STRENGTH_LABELS,
  VISIBILITY_LABELS,
  idleState,
  relationshipValues,
  strengthValues,
  visibilityValues,
  type ActionState,
} from "@/lib/validation";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type RecommendationDefaults = {
  id?: string;
  name?: string;
  phone?: string | null;
  kind?: "business" | "individual";
  categoryId?: string | null;
  zip?: string | null;
  country?: string | null;
  city?: string | null;
  websiteUrl?: string | null;
  relationship?: (typeof relationshipValues)[number];
  strength?: (typeof strengthValues)[number];
  note?: string | null;
  visibility?: (typeof visibilityValues)[number];
  groupIds?: string[];
};

export type MyGroupOption = { id: string; name: string; memberCount: number };

export function RecommendationForm({
  action,
  groups,
  myGroups = [],
  defaults,
  submitLabel,
}: {
  action: Action;
  groups: CategoryGroup[];
  myGroups?: MyGroupOption[];
  defaults?: RecommendationDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const editing = Boolean(defaults?.id);

  const [kind, setKind] = useState<"business" | "individual">(defaults?.kind ?? "business");
  const [country, setCountry] = useState(defaults?.country || "US");
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? "");
  const [visibility, setVisibility] = useState<(typeof visibilityValues)[number]>(
    defaults?.visibility ?? "private",
  );

  const abroad = country !== "US";

  // Healthcare and legal categories carry extra rules, shown the moment one is picked.
  const selected = useMemo(() => {
    for (const group of groups) {
      const hit = group.options.find((o) => o.id === categoryId);
      if (hit) return hit;
    }
    return null;
  }, [groups, categoryId]);
  const professional = Boolean(selected?.professional);
  const immigration = selected?.slug === "immigration-attorney";

  // Anything in the collapsed section that has an error must open it.
  const detailErrors = ["zip", "city", "websiteUrl", "relationship", "strength", "note", "visibility"].some(
    (f) => state.fieldErrors?.[f]?.length,
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Who are you recommending?</h2>
          {!editing && (
            <p className="mt-1 text-sm text-ink-muted">
              Just the name, number and what they do. Everything else is optional.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                value: "business",
                title: "A business",
                blurb: "A company — plumber, restaurant, garage, salon.",
              },
              {
                value: "individual",
                title: "A person",
                blurb:
                  "An individual — babysitter, tutor, cleaner. Their details are only shown to people you are connected to.",
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={[
                "cursor-pointer rounded-xl border p-4 transition-colors",
                kind === option.value
                  ? "border-brand-500 bg-brand-50"
                  : "border-line-strong hover:bg-surface-sunken",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="kind"
                  value={option.value}
                  checked={kind === option.value}
                  onChange={() => setKind(option.value)}
                  className="h-4 w-4"
                />
                <span className="font-medium text-ink">{option.title}</span>
              </span>
              <span className="mt-1 block text-sm text-ink-muted">{option.blurb}</span>
            </label>
          ))}
        </div>

        <Field
          label={kind === "business" ? "Business name" : "Their name"}
          htmlFor="name"
          errors={state.fieldErrors?.name}
          required
        >
          <Input
            id="name"
            name="name"
            defaultValue={defaults?.name}
            placeholder={kind === "business" ? "Mike's Plumbing" : "Sarah Johnson"}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
          <Field
            label="Where are they?"
            htmlFor="country"
            hint={abroad ? "Back home, or anywhere else." : undefined}
          >
            <Select
              id="country"
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Phone number"
            htmlFor="phone"
            hint="How we keep one profile per contact when someone else recommends them too."
            errors={state.fieldErrors?.phone}
            required
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder={abroad ? "+91 98480 12345" : "(937) 555-0148"}
              defaultValue={defaults?.phone ?? ""}
              required
            />
          </Field>
        </div>

        <Field
          label="Category"
          htmlFor="categoryId"
          errors={state.fieldErrors?.categoryId}
          required
        >
          <Select
            id="categoryId"
            name="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="" disabled>
              Choose a category
            </option>
            {groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        {professional && (
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/60 p-4 text-sm text-ink-muted">
            <p className="font-medium text-ink">Contact only, for doctors and lawyers</p>
            <p>{PROFESSIONAL_DISCLAIMER}</p>
            <p>{PROFESSIONAL_NOTE_WARNING}</p>
            {immigration && <p className="font-medium text-amber-800">{IMMIGRATION_WARNING}</p>}
          </div>
        )}
      </Card>

      <details
        className="group rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]"
        open={editing || detailErrors}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <span>
            <span className="font-semibold text-ink">Add detail</span>
            <span className="ml-2 text-sm text-ink-muted">
              How you know them, a note, who can see it
            </span>
          </span>
          <span aria-hidden="true" className="text-ink-muted transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>

        <div className="space-y-4 border-t border-line p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {abroad ? (
              <Field
                label="City"
                htmlFor="city"
                hint="So people can tell which one."
                errors={state.fieldErrors?.city}
              >
                <Input id="city" name="city" defaultValue={defaults?.city ?? ""} />
              </Field>
            ) : (
              <Field
                label="ZIP code"
                htmlFor="zip"
                hint="Helps people nearby find them."
                errors={state.fieldErrors?.zip}
              >
                <Input
                  id="zip"
                  name="zip"
                  inputMode="numeric"
                  maxLength={5}
                  defaultValue={defaults?.zip ?? ""}
                />
              </Field>
            )}

            <Field label="Website" htmlFor="websiteUrl" errors={state.fieldErrors?.websiteUrl}>
              <Input
                id="websiteUrl"
                name="websiteUrl"
                type="url"
                placeholder="https://"
                defaultValue={defaults?.websiteUrl ?? ""}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="How do you know them?"
              htmlFor="relationship"
              errors={state.fieldErrors?.relationship}
            >
              <Select
                id="relationship"
                name="relationship"
                defaultValue={defaults?.relationship ?? "used_personally"}
              >
                {relationshipValues.map((value) => (
                  <option key={value} value={value}>
                    {RELATIONSHIP_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="How strongly?" htmlFor="strength" errors={state.fieldErrors?.strength}>
              <Select id="strength" name="strength" defaultValue={defaults?.strength ?? "recommend"}>
                {strengthValues.map((value) => (
                  <option key={value} value={value}>
                    {STRENGTH_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Your note"
            htmlFor="note"
            hint={
              professional
                ? `Up to ${PROFESSIONAL_NOTE_LIMIT} characters, and no health or legal details.`
                : "What you would tell a friend. “Used them twice, very responsive and reasonable.”"
            }
            errors={state.fieldErrors?.note}
          >
            <Textarea
              id="note"
              name="note"
              rows={4}
              maxLength={professional ? PROFESSIONAL_NOTE_LIMIT : 2000}
              defaultValue={defaults?.note ?? ""}
            />
          </Field>

          <Field
            label="Who can see this?"
            htmlFor="visibility"
            hint="Private by default. Nothing is published until you choose to share it."
            errors={state.fieldErrors?.visibility}
          >
            <Select
              id="visibility"
              name="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as (typeof visibilityValues)[number])}
            >
              {visibilityValues.map((value) => (
                <option
                  key={value}
                  value={value}
                  disabled={value === "groups" && myGroups.length === 0}
                >
                  {VISIBILITY_LABELS[value]}
                  {value === "groups" && myGroups.length === 0 ? " (join a group first)" : ""}
                </option>
              ))}
            </Select>
          </Field>

          {visibility === "groups" && myGroups.length > 0 && (
            <fieldset className="space-y-2 rounded-xl border border-line-strong p-4">
              <legend className="px-1 text-sm font-medium text-ink">Which groups?</legend>
              {myGroups.map((g) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="groupIds"
                    value={g.id}
                    defaultChecked={defaults?.groupIds?.includes(g.id)}
                    className="h-4 w-4"
                  />
                  {g.name} <span className="text-ink-muted">({g.memberCount} members)</span>
                </label>
              ))}
            </fieldset>
          )}

          {visibility === "link" && (
            <p className="rounded-xl bg-gold-100 px-4 py-3 text-sm text-gold-700">
              Anyone with the link can see this, including people outside your network. Only
              entries set to this appear on a shared list.
            </p>
          )}
        </div>
      </details>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
