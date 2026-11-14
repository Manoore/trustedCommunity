"use client";

import { useState } from "react";
import { createHelpPostAction } from "@/app/actions/help";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import {
  ACCOMMODATION_KINDS,
  KIND_EMOJI,
  KIND_LABELS,
  type HelpKind,
} from "@/lib/help-constants";
import { SAFETY_RULES } from "@/lib/arrival";
import { idleState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

type Direction = "offer" | "need";

const KINDS: HelpKind[] = ["pickup", "temp_stay", "room", "item"];

const COPY: Record<
  HelpKind,
  {
    area: string;
    areaHint: string;
    start: string | null;
    end: string | null;
    capacity: string;
    titleOffer: string;
    titleNeed: string;
  }
> = {
  pickup: {
    area: "Airport",
    areaHint: "e.g. DFW Terminal D",
    start: "Landing date",
    end: null,
    capacity: "How many people can you take?",
    titleOffer: "Can pick up from DFW on Aug 18",
    titleNeed: "Landing at DFW on Aug 18, need a pickup",
  },
  temp_stay: {
    area: "Neighbourhood",
    areaHint: "Near campus, a short walk, etc.",
    start: "From",
    end: "Until",
    capacity: "How many guests can you host?",
    titleOffer: "Spare bed for a newcomer's first week",
    titleNeed: "Need somewhere to stay for the first week",
  },
  room: {
    area: "Neighbourhood or near campus",
    areaHint: "Be specific about where.",
    start: "Available from",
    end: "Available until (optional)",
    capacity: "How many rooms or spots?",
    titleOffer: "Room opening up — I'm graduating in May",
    titleNeed: "Looking for a room near campus from August",
  },
  item: {
    area: "Pickup area",
    areaHint: "Where it can be collected.",
    start: null,
    end: null,
    capacity: "How many sets or items?",
    titleOffer: "Desk, chair and kitchen things, free to a newcomer",
    titleNeed: "Looking for a desk and bedding to borrow or take over",
  },
};

export function HelpPostForm({
  defaultDirection = "need",
  defaultKind = "pickup",
  airport,
}: {
  defaultDirection?: Direction;
  defaultKind?: HelpKind;
  airport?: string | null;
}) {
  const [state, formProps, pending] = useFormAction(createHelpPostAction, idleState);
  const [direction, setDirection] = useState<Direction>(defaultDirection);
  const [kind, setKind] = useState<HelpKind>(defaultKind);
  const copy = COPY[kind];
  const accommodation = ACCOMMODATION_KINDS.includes(kind);

  return (
    <form {...formProps} className="space-y-6">
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Card className="space-y-4">
        <h2 className="font-semibold text-ink">Which is it?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: "need", title: "I need help", blurb: "You are arriving, or settling in." },
              { value: "offer", title: "I can help", blurb: "You have already been through it." },
            ] as const
          ).map((o) => (
            <label
              key={o.value}
              className={[
                "cursor-pointer rounded-xl border p-4 transition-colors",
                direction === o.value
                  ? "border-brand-500 bg-brand-50"
                  : "border-line-strong hover:bg-surface-sunken",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="direction"
                  value={o.value}
                  checked={direction === o.value}
                  onChange={() => setDirection(o.value)}
                  className="h-4 w-4"
                />
                <span className="font-medium text-ink">{o.title}</span>
              </span>
              <span className="mt-1 block text-sm text-ink-muted">{o.blurb}</span>
            </label>
          ))}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">What kind of help?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {KINDS.map((k) => (
              <label
                key={k}
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                  kind === k
                    ? "border-brand-500 bg-brand-50"
                    : "border-line-strong hover:bg-surface-sunken",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="h-4 w-4"
                />
                <span aria-hidden="true" className="text-xl">
                  {KIND_EMOJI[k]}
                </span>
                <span className="text-sm font-medium text-ink">{KIND_LABELS[k]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      {accommodation && (
        <Card className="border-amber-300 bg-amber-50/60">
          <h2 className="font-semibold text-ink">Before you post about a place to stay</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
            {SAFETY_RULES.slice(0, 2).map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
            <li>
              Describe the place and the household&apos;s real needs (budget, quiet hours,
              cleanliness). Posts cannot state a preference based on race, colour, religion
              or national origin.
            </li>
          </ul>
        </Card>
      )}

      <Card className="space-y-4">
        <Field
          label="Title"
          htmlFor="title"
          errors={state.fieldErrors?.title}
          hint="One line a stranger would understand."
          required
        >
          <Input
            id="title"
            name="title"
            maxLength={140}
            placeholder={direction === "offer" ? copy.titleOffer : copy.titleNeed}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.area} htmlFor="area" hint={copy.areaHint} errors={state.fieldErrors?.area}>
            <Input id="area" name="area" defaultValue={kind === "pickup" ? (airport ?? "") : ""} />
          </Field>
          {direction === "offer" && (
            <Field label={copy.capacity} htmlFor="capacity" errors={state.fieldErrors?.capacity}>
              <Input id="capacity" name="capacity" type="number" min={1} max={10} defaultValue={1} />
            </Field>
          )}
        </div>

        {(copy.start || copy.end) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {copy.start && (
              <Field
                label={copy.start}
                htmlFor="startsOn"
                errors={state.fieldErrors?.startsOn}
                required={kind === "pickup"}
              >
                <Input id="startsOn" name="startsOn" type="date" required={kind === "pickup"} />
              </Field>
            )}
            {copy.end && (
              <Field label={copy.end} htmlFor="endsOn" errors={state.fieldErrors?.endsOn}>
                <Input id="endsOn" name="endsOn" type="date" />
              </Field>
            )}
          </div>
        )}

        <Field
          label="Details"
          htmlFor="details"
          hint="Flight details, house rules, what is included — anything that saves a back-and-forth."
          errors={state.fieldErrors?.details}
        >
          <Textarea id="details" name="details" rows={5} />
        </Field>

        <Field
          label="Phone (optional)"
          htmlFor="contactPhone"
          hint="Shared only with the one person whose response you accept. Your account email is shared the same way."
          errors={state.fieldErrors?.contactPhone}
        >
          <Input id="contactPhone" name="contactPhone" type="tel" placeholder="(937) 555-0148" />
        </Field>
      </Card>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Posting…" : direction === "offer" ? "Post my offer" : "Post my request"}
      </Button>
      <p className="text-xs text-ink-muted">
        No money changes hands through this site. Never pay a deposit or fee to someone you have
        not met.
      </p>
    </form>
  );
}
