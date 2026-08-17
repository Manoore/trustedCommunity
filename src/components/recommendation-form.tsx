"use client";

import { useActionState, useState } from "react";
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
  const [kind, setKind] = useState<"business" | "individual">(
    defaults?.kind ?? "business",
  );
  const [visibility, setVisibility] = useState<
    (typeof visibilityValues)[number]
  >(defaults?.visibility ?? "private");

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold text-ink">Who are you recommending?</h2>

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

        <Field
          label="Phone number"
          htmlFor="phone"
          hint="This is how we keep one profile per contact when someone else recommends them too."
          errors={state.fieldErrors?.phone}
          required
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="(937) 555-0148"
            defaultValue={defaults?.phone ?? ""}
            required
          />
        </Field>

        <Field
          label="Category"
          htmlFor="categoryId"
          errors={state.fieldErrors?.categoryId}
          required
        >
          <Select
            id="categoryId"
            name="categoryId"
            defaultValue={defaults?.categoryId ?? ""}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="ZIP code"
            htmlFor="zip"
            hint="Optional. Helps people nearby find them."
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
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Your recommendation</h2>
          <p className="mt-1 text-sm text-ink-muted">
            No star ratings here. You either vouch for someone or you say nothing —
            that is what makes this worth reading.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="How do you know them?"
            htmlFor="relationship"
            errors={state.fieldErrors?.relationship}
            required
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

          <Field
            label="How strongly?"
            htmlFor="strength"
            errors={state.fieldErrors?.strength}
            required
          >
            <Select
              id="strength"
              name="strength"
              defaultValue={defaults?.strength ?? "recommend"}
            >
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
          hint="What you would tell a friend. “Used them twice, very responsive and reasonable.”"
          errors={state.fieldErrors?.note}
        >
          <Textarea id="note" name="note" rows={4} defaultValue={defaults?.note ?? ""} />
        </Field>

        <Field
          label="Who can see this?"
          htmlFor="visibility"
          hint="Private by default. Nothing is published until you choose to share it."
          errors={state.fieldErrors?.visibility}
          required
        >
          <Select
            id="visibility"
            name="visibility"
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as (typeof visibilityValues)[number])
            }
          >
            {visibilityValues.map((value) => (
              <option
                key={value}
                value={value}
                disabled={value === "groups" && myGroups.length === 0}
              >
                {VISIBILITY_LABELS[value]}
                {value === "groups" && myGroups.length === 0
                  ? " (join a group first)"
                  : ""}
              </option>
            ))}
          </Select>
        </Field>

        {visibility === "groups" && myGroups.length > 0 && (
          <fieldset className="space-y-2 rounded-xl border border-line-strong p-4">
            <legend className="px-1 text-sm font-medium text-ink">
              Which groups?
            </legend>
            {myGroups.map((g) => (
              <label
                key={g.id}
                className="flex cursor-pointer items-center gap-3 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  name="groupIds"
                  value={g.id}
                  defaultChecked={defaults?.groupIds?.includes(g.id)}
                  className="h-4 w-4"
                />
                {g.name}{" "}
                <span className="text-ink-muted">({g.memberCount} members)</span>
              </label>
            ))}
          </fieldset>
        )}

        {visibility === "link" && (
          <p className="rounded-xl bg-gold-100 px-4 py-3 text-sm text-gold-700">
            Anyone with the link can see this, including people outside your network.
            Only entries set to this appear on a shared list.
          </p>
        )}
      </Card>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
