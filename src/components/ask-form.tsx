"use client";

import { useState } from "react";
import { createAskAction } from "@/app/actions/asks";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import type { CategoryGroup } from "@/components/listing-form";
import { idleState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

export type AskGroupOption = { id: string; name: string; memberCount: number };

export function AskForm({
  categoryGroups,
  groups,
  hasConnections,
}: {
  categoryGroups: CategoryGroup[];
  groups: AskGroupOption[];
  hasConnections: boolean;
}) {
  const [state, formProps, pending] = useFormAction(createAskAction, idleState);
  const [toConnections, setToConnections] = useState(hasConnections);

  return (
    <form {...formProps} className="space-y-6">
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Card className="space-y-4">
        <h2 className="font-semibold text-ink">What do you need?</h2>

        <Field
          label="Your request"
          htmlFor="title"
          hint="Write it the way you would text a friend."
          errors={state.fieldErrors?.title}
          required
        >
          <Input
            id="title"
            name="title"
            placeholder="Anyone know a good electrician?"
            required
          />
        </Field>

        <Field label="Any detail?" htmlFor="body" errors={state.fieldErrors?.body}>
          <Textarea
            id="body"
            name="body"
            rows={3}
            placeholder="Needs to replace a panel, ideally in the next couple of weeks."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="categoryId">
            <Select id="categoryId" name="categoryId" defaultValue="">
              <option value="">Any category</option>
              {categoryGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>

          <Field label="ZIP code" htmlFor="zip" errors={state.fieldErrors?.zip}>
            <Input id="zip" name="zip" inputMode="numeric" maxLength={5} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Who should see this?</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Only the people you pick. This is never posted publicly.
          </p>
        </div>

        <label
          className={[
            "flex cursor-pointer items-start gap-3 rounded-xl border p-4",
            toConnections
              ? "border-brand-500 bg-brand-50"
              : "border-line-strong hover:bg-surface-sunken",
            !hasConnections && "opacity-50",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <input
            type="checkbox"
            name="toConnections"
            checked={toConnections}
            disabled={!hasConnections}
            onChange={(e) => setToConnections(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium text-ink">All my connections</span>
            <span className="mt-0.5 block text-sm text-ink-muted">
              {hasConnections
                ? "Everyone you are connected to."
                : "You have no connections yet."}
            </span>
          </span>
        </label>

        {groups.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Groups</legend>
            {groups.map((g) => (
              <label
                key={g.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong p-3 hover:bg-surface-sunken"
              >
                <input
                  type="checkbox"
                  name="groupIds"
                  value={g.id}
                  className="h-4 w-4"
                />
                <span className="text-sm text-ink">
                  {g.name}{" "}
                  <span className="text-ink-muted">({g.memberCount} members)</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </Card>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Ask my network"}
      </Button>
    </form>
  );
}
