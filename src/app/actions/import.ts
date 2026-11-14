"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, providers, recommendations } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { parseContacts } from "@/lib/import-contacts";
import { isKnownCountry } from "@/lib/countries";
import { isCategoryBlocked } from "@/lib/professional";
import { normalizePhone } from "@/lib/phone";
import { rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { uniqueSlug } from "@/lib/slug";
import type { ActionState } from "@/lib/validation";

const MAX_ROWS = 200;

export type ImportPreviewState = ActionState & {
  preview?: {
    name: string;
    phone: string;
    e164: string | null;
    raw: string;
    existingName?: string | null;
  }[];
  skipped?: string[];
  raw?: string;
};

/** Step one: parse the paste and show what would happen. Writes nothing. */
export async function previewImportAction(
  _prev: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/import");

  const raw = String(formData.get("raw") ?? "");
  const { contacts, skipped } = parseContacts(raw);

  if (!contacts.length) {
    return {
      ok: false,
      message:
        "Nothing recognisable in that. Paste a vCard export, or one contact per line as: Name, phone number.",
      skipped,
      raw,
    };
  }

  const capped = contacts.slice(0, MAX_ROWS);

  // Tell them up front which numbers already belong to a contact here.
  const preview = await Promise.all(
    capped.map(async (c) => {
      if (!c.e164) return { ...c, existingName: null };
      const [existing] = await db
        .select({ displayName: providers.displayName })
        .from(providers)
        .where(eq(providers.normalizedPhone, c.e164))
        .limit(1);
      return { ...c, existingName: existing?.displayName ?? null };
    }),
  );

  return {
    ok: true,
    preview,
    skipped,
    raw,
    message:
      contacts.length > MAX_ROWS
        ? `Showing the first ${MAX_ROWS} of ${contacts.length}. Import these, then paste the rest.`
        : undefined,
  };
}

/**
 * Step two: create the contacts and attach a private recommendation to each.
 *
 * Everything lands as `private` with no note — an import is a starting point,
 * not a claim that you vouch for all of them publicly. The user then edits the
 * ones they actually want to share.
 */
export async function confirmImportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/import");

  const limit = await rateLimit("import", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const names = formData.getAll("name").map(String);
  const phones = formData.getAll("phone").map(String);
  const selected = new Set(formData.getAll("selected").map(String));

  const categoryId = String(formData.get("categoryId") ?? "");
  if (!categoryId) {
    return { ok: false, message: "Pick a category to file these under." };
  }

  const [category] = await db
    .select({
      id: categories.id,
      restricted: categories.restricted,
      professional: categories.professional,
    })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (!category || isCategoryBlocked(category)) {
    return { ok: false, message: "Pick an accepted category." };
  }

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < names.length; i++) {
    if (!selected.has(String(i))) continue;

    const name = names[i]?.trim();
    const phone = normalizePhone(phones[i]);
    if (!name || !phone) {
      skipped++;
      continue;
    }

    const [existing] = await db
      .select({ id: providers.id, hiddenAt: providers.hiddenAt })
      .from(providers)
      .where(eq(providers.normalizedPhone, phone.e164))
      .limit(1);

    // Someone who asked to be removed stays removed, even via bulk import.
    if (existing?.hiddenAt) {
      skipped++;
      continue;
    }

    let providerId = existing?.id;
    if (!providerId) {
      const [row] = await db
        .insert(providers)
        .values({
          type: "entity",
          kind: "business",
          slug: uniqueSlug(name),
          displayName: name,
          contactPhone: phone.display,
          normalizedPhone: phone.e164,
          // A +91 number is a contact in India, not an American one.
          country: phone.country && isKnownCountry(phone.country) ? phone.country : "US",
          status: "active",
          createdByUserId: user.id,
        })
        .returning({ id: providers.id });
      providerId = row.id;
    }

    await db
      .insert(recommendations)
      .values({
        recommenderUserId: user.id,
        providerId,
        categoryId: category.id,
        relationship: "know_of",
        strength: "recommend",
        visibility: "private",
      })
      .onConflictDoNothing();

    created++;
  }

  revalidatePath("/list");
  redirect(`/list?imported=${created}&skipped=${skipped}`);
}
