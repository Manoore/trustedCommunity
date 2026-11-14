"use client";


import { createReviewAction } from "@/app/actions/reviews";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { idleState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

export function ReviewForm({ inquiryId }: { inquiryId: string }) {
  const [state, formProps, pending] = useFormAction(createReviewAction, idleState);

  if (state.ok) return <Alert tone="success">{state.message}</Alert>;

  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field label="Rating" htmlFor="rating" errors={state.fieldErrors?.rating} required>
        <Select id="rating" name="rating" defaultValue="5" required>
          <option value="5">5 — excellent</option>
          <option value="4">4 — good</option>
          <option value="3">3 — okay</option>
          <option value="2">2 — poor</option>
          <option value="1">1 — bad</option>
        </Select>
      </Field>

      <Field label="Headline (optional)" htmlFor="title" errors={state.fieldErrors?.title}>
        <Input id="title" name="title" maxLength={120} />
      </Field>

      <Field
        label="Your review"
        htmlFor="body"
        errors={state.fieldErrors?.body}
        hint="What was the work, and how did it go?"
        required
      >
        <Textarea id="body" name="body" rows={4} required />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post review"}
      </Button>
    </form>
  );
}
