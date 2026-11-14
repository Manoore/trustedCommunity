"use client";

import { useState } from "react";
import { createReportAction } from "@/app/actions/reports";
import { Alert, Button, Field, Select, Textarea } from "@/components/ui";
import { idleState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

const REASONS = [
  { value: "spam", label: "Spam or duplicate" },
  { value: "scam-or-fraud", label: "Scam or fraud" },
  { value: "asked-for-money", label: "Asked me for money or a deposit" },
  { value: "unsafe", label: "Made me feel unsafe" },
  { value: "wrong-category", label: "Wrong category" },
  { value: "unlicensed-work", label: "Advertising licensed work without a licence" },
  { value: "offensive", label: "Offensive or abusive" },
  { value: "impersonation", label: "Impersonating a business or person" },
  { value: "other", label: "Something else" },
];

export function ReportForm({
  targetType,
  targetId,
}: {
  targetType: "listing" | "review" | "provider" | "message" | "help_post";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formProps, pending] = useFormAction(createReportAction, idleState);

  if (state.ok) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ink-muted underline hover:text-ink"
      >
        Report this {targetType === "help_post" ? "post" : targetType}
      </button>
    );
  }

  return (
    <form {...formProps} className="space-y-3 rounded-lg border border-line p-4">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />

      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field label="Reason" htmlFor="reason" errors={state.fieldErrors?.reason} required>
        <Select id="reason" name="reason" required defaultValue="">
          <option value="" disabled>
            Pick a reason
          </option>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Details (optional)" htmlFor="details">
        <Textarea id="details" name="details" rows={3} />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Submit report"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
