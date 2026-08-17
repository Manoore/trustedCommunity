"use client";

import { useActionState } from "react";
import { answerAskAction } from "@/app/actions/asks";
import { Alert, Button, Field, Select, Textarea } from "@/components/ui";
import { idleState } from "@/lib/validation";

export type AnswerOption = { id: string; name: string; categoryName: string | null };

export function AnswerAskForm({
  askId,
  options,
}: {
  askId: string;
  options: AnswerOption[];
}) {
  const [state, formAction, pending] = useActionState(answerAskAction, idleState);

  if (state.ok) return <Alert tone="success">{state.message}</Alert>;

  if (!options.length) {
    return (
      <Alert tone="info">
        You can only answer with someone already on your own list — that is what keeps
        answers real. Add them first, then come back.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="askId" value={askId} />
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field
        label="Who do you recommend?"
        htmlFor="recommendationId"
        hint="Pick from your own list."
        required
      >
        <Select id="recommendationId" name="recommendationId" defaultValue="" required>
          <option value="" disabled>
            Choose someone
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.categoryName ? ` — ${o.categoryName}` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Anything to add?" htmlFor="note">
        <Textarea
          id="note"
          name="note"
          rows={3}
          placeholder="He did our panel last year, quoted fairly."
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send this answer"}
      </Button>
    </form>
  );
}
