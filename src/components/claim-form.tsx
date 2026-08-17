"use client";

import { useActionState, useState } from "react";
import { requestClaimAction } from "@/app/actions/claims";
import {
  Alert,
  Button,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { idleState } from "@/lib/validation";

export function ClaimForm({
  providerId,
  name,
}: {
  providerId: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(requestClaimAction, idleState);
  const [kind, setKind] = useState<"claim" | "removal">("removal");

  if (state.ok) return <Alert tone="success">{state.message}</Alert>;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="providerId" value={providerId} />

      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field label="What would you like to do?" htmlFor="kind" required>
        <Select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as "claim" | "removal")}
        >
          <option value="removal">Remove me from this site</option>
          <option value="claim">This is me — I want to manage this profile</option>
        </Select>
      </Field>

      {kind === "removal" && (
        <Alert tone="info">
          Submitting this hides {name} straight away. An admin will confirm it shortly
          after.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Your email"
          htmlFor="contactEmail"
          errors={state.fieldErrors?.contactEmail}
        >
          <Input id="contactEmail" name="contactEmail" type="email" />
        </Field>
        <Field
          label="Your phone"
          htmlFor="contactPhone"
          errors={state.fieldErrors?.contactPhone}
        >
          <Input id="contactPhone" name="contactPhone" type="tel" />
        </Field>
      </div>

      <Field
        label="Anything else?"
        htmlFor="message"
        errors={state.fieldErrors?.message}
      >
        <Textarea id="message" name="message" rows={3} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : kind === "removal" ? "Remove me" : "Claim this profile"}
      </Button>
    </form>
  );
}
