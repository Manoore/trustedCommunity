"use client";

import { useRef, useState } from "react";
import {
  confirmImportAction,
  previewImportAction,
  type ImportPreviewState,
} from "@/app/actions/import";
import { Alert, Badge, Button, Card, Field, Select, Textarea } from "@/components/ui";
import type { CategoryGroup } from "@/components/listing-form";
import { idleState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

type ContactsApi = {
  select: (
    props: string[],
    opts?: { multiple?: boolean },
  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
};

export function ImportForm({
  categoryGroups,
  initialText = "",
}: {
  categoryGroups: CategoryGroup[];
  /** Text handed over by the phone's share sheet. */
  initialText?: string;
}) {
  // The textarea already echoes `preview.raw`, so keep it as typed after a preview.
  const [preview, previewProps, previewPending] = useFormAction<ImportPreviewState>(
    previewImportAction,
    idleState,
    { resetOnSuccess: false },
  );
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  // Only Chrome on Android exposes this. Elsewhere the button simply is not shown.
  const supportsPicker =
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    typeof window !== "undefined" &&
    "ContactsManager" in window;

  async function pickFromPhone() {
    setPickerError(null);
    try {
      const api = (navigator as unknown as { contacts: ContactsApi }).contacts;
      const picked = await api.select(["name", "tel"], { multiple: true });
      const lines = picked
        .map((c) => {
          const name = c.name?.[0]?.trim();
          const tel = c.tel?.[0]?.trim();
          return name && tel ? `${name}, ${tel}` : null;
        })
        .filter(Boolean);
      if (textRef.current && lines.length) {
        const existing = textRef.current.value.trim();
        textRef.current.value = [existing, ...lines].filter(Boolean).join("\n");
      }
    } catch {
      setPickerError("Could not open your contacts. You can paste them instead.");
    }
  }
  const [confirm, confirmProps, confirmPending] = useFormAction(
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

        <form {...previewProps} className="space-y-3">
          {preview.message && (
            <Alert tone={preview.ok ? "info" : "error"}>{preview.message}</Alert>
          )}
          <Field label="Contacts" htmlFor="raw" required>
            <Textarea
              id="raw"
              name="raw"
              ref={textRef}
              rows={8}
              defaultValue={preview.raw ?? initialText}
              placeholder={"Mike's Plumbing, 937-555-0148\nDave's Electric, 937-555-0210"}
              required
            />
          </Field>
          {pickerError && <Alert tone="error">{pickerError}</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" disabled={previewPending}>
              {previewPending ? "Reading…" : "Preview"}
            </Button>
            {supportsPicker && (
              <Button type="button" variant="ghost" onClick={pickFromPhone}>
                📇 Pick from my phone
              </Button>
            )}
          </div>
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

          <form {...confirmProps} className="space-y-4">
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
