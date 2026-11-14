"use client";

import { useActionState } from "react";
import { updateGroupSettingsAction } from "@/app/actions/groups";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { idleState } from "@/lib/validation";

export function GroupSettingsForm({
  groupId,
  welcomeMessage,
  memberLimit,
  memberCount,
}: {
  groupId: string;
  welcomeMessage: string | null;
  memberLimit: number | null;
  memberCount: number;
}) {
  const [state, formAction, pending] = useActionState(updateGroupSettingsAction, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="groupId" value={groupId} />
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}

      <Field
        label="Welcome message"
        htmlFor="welcomeMessage"
        hint="Shown to everyone who joins. Tell them what this group is for."
        errors={state.fieldErrors?.welcomeMessage}
      >
        <Textarea
          id="welcomeMessage"
          name="welcomeMessage"
          rows={3}
          maxLength={500}
          defaultValue={welcomeMessage ?? ""}
        />
      </Field>

      <Field
        label="Member limit"
        htmlFor="memberLimit"
        hint={`Leave blank for no limit. There are ${memberCount} members now.`}
        errors={state.fieldErrors?.memberLimit}
      >
        <Input
          id="memberLimit"
          name="memberLimit"
          inputMode="numeric"
          className="max-w-[10rem]"
          defaultValue={memberLimit ?? ""}
        />
      </Field>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
