"use client";

import { useActionState } from "react";
import { addTeamMemberAction } from "@/app/actions/providers";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { idleState } from "@/lib/validation";

export function TeamInviteForm({ providerId }: { providerId: string }) {
  const [state, formAction, pending] = useActionState(addTeamMemberAction, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="providerId" value={providerId} />

      {state.message && (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      )}

      <Field
        label="Their email"
        htmlFor="email"
        errors={state.fieldErrors?.email}
        required
      >
        <Input id="email" name="email" type="email" required />
      </Field>

      <Field label="Role" htmlFor="role" errors={state.fieldErrors?.role} required>
        <Select id="role" name="role" defaultValue="manager">
          <option value="manager">Manager — post and edit listings</option>
          <option value="staff">Staff — handle inquiries only</option>
        </Select>
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add to team"}
      </Button>
    </form>
  );
}
