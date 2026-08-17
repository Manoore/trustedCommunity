"use client";

import { useActionState } from "react";
import { sendConnectionRequestAction } from "@/app/actions/connections";
import { Alert, Button, Field, Input } from "@/components/ui";
import { idleState } from "@/lib/validation";

export function ConnectionInviteForm() {
  const [state, formAction, pending] = useActionState(
    sendConnectionRequestAction,
    idleState,
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.message && (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      )}

      <Field
        label="Their email"
        htmlFor="email"
        hint="They have to accept before either of you sees anything."
        errors={state.fieldErrors?.email}
        required
      >
        <Input id="email" name="email" type="email" required />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
