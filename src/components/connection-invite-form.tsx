"use client";


import { sendConnectionRequestAction } from "@/app/actions/connections";
import { Alert, Button, Field, Input } from "@/components/ui";
import { idleState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

export function ConnectionInviteForm() {
  const [state, formProps, pending] = useFormAction(
    sendConnectionRequestAction,
    idleState,
  );

  return (
    <form {...formProps} className="space-y-3">
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
