"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { deleteMediaAction } from "@/app/actions/listings";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { RADIUS_LADDER } from "@/lib/geo-constants";
import { idleState, type ActionState } from "@/lib/validation";
import { useFormAction } from "@/lib/use-form-action";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type CategoryOption = {
  id: string;
  name: string;
  slug?: string;
  licenseRequired: boolean;
  professional?: boolean;
};

export type CategoryGroup = { label: string; options: CategoryOption[] };

export type ListingDefaults = {
  id?: string;
  categoryId?: string;
  title?: string;
  description?: string;
  priceType?: "hourly" | "fixed" | "starting_at" | "quote";
  priceMinCents?: number | null;
  priceMaxCents?: number | null;
  remoteOk?: boolean;
  zip?: string | null;
  serviceRadiusMiles?: number;
  licenseNumber?: string | null;
  licenseState?: string | null;
  media?: { id: string; url: string; alt: string | null }[];
};

const centsToDollars = (cents: number | null | undefined) =>
  cents == null ? "" : String(cents / 100);

export function ListingForm({
  action,
  groups,
  providerId,
  defaults,
  submitLabel,
}: {
  action: Action;
  groups: CategoryGroup[];
  providerId: string;
  defaults?: ListingDefaults;
  submitLabel: string;
}) {
  const [state, formProps, pending] = useFormAction(action, idleState);
  const [categoryId, setCategoryId] = useState(defaults?.categoryId ?? "");
  const [priceType, setPriceType] = useState(defaults?.priceType ?? "quote");
  const [remoteOk, setRemoteOk] = useState(Boolean(defaults?.remoteOk));

  const byId = useMemo(() => {
    const map = new Map<string, CategoryOption>();
    for (const group of groups) for (const opt of group.options) map.set(opt.id, opt);
    return map;
  }, [groups]);

  const selected = byId.get(categoryId);
  const needsLicense = Boolean(selected?.licenseRequired);

  return (
    <form {...formProps} className="space-y-6">
      <input type="hidden" name="providerId" value={providerId} />
      {defaults?.id && <input type="hidden" name="listingId" value={defaults.id} />}

      {state.message && (
        <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold text-ink">What are you offering?</h2>

        <Field
          label="Category"
          htmlFor="categoryId"
          errors={state.fieldErrors?.categoryId}
          required
        >
          <Select
            id="categoryId"
            name="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="" disabled>
              Choose a category
            </option>
            {groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                    {opt.licenseRequired ? " (licence required)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        <Field
          label="Listing title"
          htmlFor="title"
          hint="What a buyer would search for. Not your company name."
          errors={state.fieldErrors?.title}
          required
        >
          <Input
            id="title"
            name="title"
            maxLength={140}
            placeholder="Emergency & repair plumbing"
            defaultValue={defaults?.title}
            required
          />
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          hint="Scope, what is included, how you price, and how fast you respond."
          errors={state.fieldErrors?.description}
          required
        >
          <Textarea
            id="description"
            name="description"
            rows={8}
            defaultValue={defaults?.description}
            required
          />
        </Field>
      </Card>

      {needsLicense && (
        <Card className="space-y-4 border-amber-300">
          <div>
            <h2 className="font-semibold text-ink">Licence</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {selected?.name} is a licensed trade in most states. Your listing stays in
              review until an admin checks this number, then it goes live.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Licence number"
              htmlFor="licenseNumber"
              errors={state.fieldErrors?.licenseNumber}
              required
            >
              <Input
                id="licenseNumber"
                name="licenseNumber"
                defaultValue={defaults?.licenseNumber ?? ""}
              />
            </Field>
            <Field
              label="Issuing state"
              htmlFor="licenseState"
              hint="Two-letter code, e.g. TX"
              errors={state.fieldErrors?.licenseState}
            >
              <Input
                id="licenseState"
                name="licenseState"
                maxLength={2}
                defaultValue={defaults?.licenseState ?? ""}
              />
            </Field>
          </div>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold text-ink">Pricing</h2>

        <Field label="How do you price?" htmlFor="priceType" required>
          <Select
            id="priceType"
            name="priceType"
            value={priceType}
            onChange={(e) => setPriceType(e.target.value as typeof priceType)}
          >
            <option value="quote">Request a quote</option>
            <option value="hourly">Hourly rate</option>
            <option value="fixed">Fixed price</option>
            <option value="starting_at">Starting at</option>
          </Select>
        </Field>

        {priceType !== "quote" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={priceType === "hourly" ? "Rate from ($/hr)" : "Price ($)"}
              htmlFor="priceMin"
              errors={state.fieldErrors?.priceMin}
              required
            >
              <Input
                id="priceMin"
                name="priceMin"
                inputMode="decimal"
                defaultValue={centsToDollars(defaults?.priceMinCents)}
              />
            </Field>
            {priceType === "hourly" && (
              <Field
                label="Rate to ($/hr)"
                htmlFor="priceMax"
                errors={state.fieldErrors?.priceMax}
              >
                <Input
                  id="priceMax"
                  name="priceMax"
                  inputMode="decimal"
                  defaultValue={centsToDollars(defaults?.priceMaxCents)}
                />
              </Field>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-ink">Where do you work?</h2>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="remoteOk"
            checked={remoteOk}
            onChange={(e) => setRemoteOk(e.target.checked)}
            className="h-4 w-4"
          />
          This work is done remotely — show it nationwide
        </label>

        {!remoteOk && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="ZIP code you work from"
              htmlFor="zip"
              errors={state.fieldErrors?.zip}
              required
            >
              <Input
                id="zip"
                name="zip"
                inputMode="numeric"
                maxLength={5}
                defaultValue={defaults?.zip ?? ""}
              />
            </Field>
            <Field
              label="How far will you travel?"
              htmlFor="serviceRadiusMiles"
              hint="Buyers further out still see you if they widen their search."
              errors={state.fieldErrors?.serviceRadiusMiles}
            >
              <Select
                id="serviceRadiusMiles"
                name="serviceRadiusMiles"
                defaultValue={String(defaults?.serviceRadiusMiles ?? 25)}
              >
                {[10, ...RADIUS_LADDER].map((r) => (
                  <option key={r} value={r}>
                    {r} miles
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold text-ink">Photos</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Up to 8 images, 5 MB each. JPEG, PNG, WebP, or AVIF.
          </p>
        </div>

        {defaults?.media && defaults.media.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {defaults.media.map((m) => (
              <li key={m.id} className="space-y-1">
                <div className="relative aspect-square overflow-hidden rounded-lg border border-line">
                  <Image
                    src={m.url}
                    alt={m.alt ?? ""}
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                </div>
                <form action={deleteMediaAction}>
                  <input type="hidden" name="mediaId" value={m.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600 underline hover:text-red-700"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <Field label="Add photos" htmlFor="images">
          <input
            id="images"
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="block w-full text-sm text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
          />
        </Field>
      </Card>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
