"use client";

import { useActionState } from "react";
import { createCollegeAction } from "@/app/actions/college";
import { Alert, Button, Field, Input } from "@/components/ui";
import { idleState } from "@/lib/validation";

export function AddCollegeForm() {
  const [state, formAction, pending] = useActionState(createCollegeAction, idleState);

  return (
    <form action={formAction} className="space-y-4">
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field label="College name" htmlFor="name" errors={state.fieldErrors?.name} required>
        <Input id="name" name="name" placeholder="University of Example" required />
      </Field>

      <Field
        label="Student email domain"
        htmlFor="domain"
        hint="What a student's address ends in. This is what proves someone belongs, so it must be right."
        errors={state.fieldErrors?.domain}
        required
      >
        <Input id="domain" name="domain" placeholder="example.edu" required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor="city" errors={state.fieldErrors?.city} required>
          <Input id="city" name="city" required />
        </Field>
        <Field label="State" htmlFor="state" errors={state.fieldErrors?.state} required>
          <Input id="state" name="state" maxLength={2} placeholder="TX" required />
        </Field>
        <Field label="Nearest airport" htmlFor="airport">
          <Input id="airport" name="airport" placeholder="DFW" />
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add my college"}
      </Button>
    </form>
  );
}
