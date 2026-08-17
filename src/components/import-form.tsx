"use client";

import { useActionState } from "react";
import {
  confirmImportAction,
  previewImportAction,
  type ImportPreviewState,
} from "@/app/actions/import";
import { Alert, Badge, Button, Card, Field, Select, Textarea } from "@/components/ui";
import type { CategoryGroup } from "@/components/listing-form";
import { idleState } from "@/lib/validation";

export function ImportForm({ categoryGroups }: { categoryGroups: CategoryGroup[] }) {
  const [preview, previewAction, previewPending] = useActionState<
    ImportPreviewState,
    FormData
  >(previewImportAction, idleState);
  const [confirm, confirmAction, confirmPending] = useActionState(
    confirmImportAction,
    idleState,
  );

  const rows = preview.preview ?? [];

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Paste your contacts</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Export from your phone or Contacts app and paste the vCard here, or type
            one per line as <code>Name, phone number</code>.
          </p>
        </div>

        <form action={previewAction} className="space-y-3">
          {preview.message && (
            <Alert tone={preview.ok ? "info" : "error"}>{preview.message}</Alert>
          )}
          <Field label="Contacts" htmlFor="raw" required>
            <Textarea
              id="raw"
              name="raw"
              rows={8}
              defaultValue={preview.raw ?? ""}
              placeholder={"Mike's Plumbing, 937-555-0148\nDave's Electric, 937-555-0210"}
              required
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={previewPending}>
            {previewPending ? "Reading…" : "Preview"}
          </Button>
        </form>
      </Card>

      {rows.length > 0 && (
        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold text-ink">
              Found {rows.length} {rows.length === 1 ? "contact" : "contacts"}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              These come in as private entries with no note. Nothing is shared until
              you edit them.
            </p>
          </div>

          {confirm.message && <Alert tone="error">{confirm.message}</Alert>}

          <form action={confirmAction} className="space-y-4">
            <Field label="File them under" htmlFor="categoryId" required>
              <Select id="categoryId" name="categoryId" defaultValue="" required>
                <option value="" disabled>
                  Choose a category
                </option>
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

            <ul className="divide-y divide-line rounded-xl border border-line">
              {rows.map((row, i) => {
                const usable = Boolean(row.e164);
                return (
                  <li key={`${row.raw}-${i}`} className="flex items-center gap-3 p-3">
                    <input
                      type="checkbox"
                      name="selected"
                      value={String(i)}
                      defaultChecked={usable}
                      disabled={!usable}
                      className="h-4 w-4"
                      aria-label={`Import ${row.name}`}
                    />
                    <input type="hidden" name="name" value={row.name} />
                    <input type="hidden" name="phone" value={row.phone} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{row.name}</p>
                      <p className="text-sm text-ink-muted">{row.phone}</p>
                    </div>
                    {!usable ? (
                      <Badge tone="danger">Unreadable number</Badge>
                    ) : row.existingName ? (
                      <Badge tone="warning">Already here as {row.existingName}</Badge>
                    ) : (
                      <Badge tone="success">New</Badge>
                    )}
                  </li>
                );
              })}
            </ul>

            <Button type="submit" size="lg" disabled={confirmPending}>
              {confirmPending ? "Importing…" : "Import selected"}
            </Button>
          </form>
        </Card>
      )}

      {preview.skipped && preview.skipped.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-ink">
            Skipped {preview.skipped.length}
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            {preview.skipped.slice(0, 10).map((s, i) => (
              <li key={i} className="truncate font-mono">
                {s}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
