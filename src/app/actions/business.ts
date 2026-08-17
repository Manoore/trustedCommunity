"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { lookupZip } from "@/lib/geo";
import { normalizePhone } from "@/lib/phone";
import { rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { uniqueSlug } from "@/lib/slug";
import { zodToState, type ActionState } from "@/lib/validation";

const businessSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name.").max(120),
  phone: z.string().trim().min(7, "Enter the number customers should call."),
  headline: z.string().trim().max(160).optional().or(z.literal("")),
  bio: z
    .string()
    .trim()
    .min(20, "Tell customers what you do — a couple of sentences is enough.")
    .max(2000),
  websiteUrl: z.string().trim().url("Enter a full URL.").optional().or(z.literal("")),
  contactEmail: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .optional()
    .or(z.literal("")),
  zip: z.string().trim().optional().or(z.literal("")),
});

/**
 * A business owner listing themselves directly, rather than waiting to be
 * recommended. This profile starts with zero recommendations — self-listing
 * gets you found, it does not substitute for someone vouching for you. The
 * `selfListedAt` marker is what lets the profile page say so plainly, so a
 * visitor can tell "this business put itself here" apart from "a neighbour
 * recommended this business".
 */
export async function claimBusinessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/business/claim");

  const limit = await rateLimit("recommendation", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = businessSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    headline: formData.get("headline") ?? "",
    bio: formData.get("bio"),
    websiteUrl: formData.get("websiteUrl") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    zip: formData.get("zip") ?? "",
  });
  if (!parsed.success) return zodToState(parsed.error);

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return { ok: false, fieldErrors: { phone: ["That does not look like a valid US phone number."] } };
  }

  const [existing] = await db
    .select({ id: providers.id, slug: providers.slug, hiddenAt: providers.hiddenAt })
    .from(providers)
    .where(eq(providers.normalizedPhone, phone.e164))
    .limit(1);

  if (existing?.hiddenAt) {
    return {
      ok: false,
      message:
        "That number was removed from the site at someone's request and cannot be re-listed. Contact support if this is a mistake.",
    };
  }

  if (existing) {
    // Already exists because someone recommended this number first. Point the
    // owner at the claim flow rather than silently creating a duplicate.
    return {
      ok: false,
      message: `A profile with this number already exists. Use "Claim this profile" on its page instead.`,
      fieldErrors: { phone: [`See it at /p/${existing.slug}`] },
    };
  }

  const geo = parsed.data.zip ? lookupZip(parsed.data.zip) : null;
  if (parsed.data.zip && !geo) {
    return { ok: false, fieldErrors: { zip: ["We do not recognise that ZIP code."] } };
  }

  const now = new Date();
  const [created] = await db
    .insert(providers)
    .values({
      type: "entity",
      kind: "business",
      slug: uniqueSlug(parsed.data.name),
      displayName: parsed.data.name,
      headline: parsed.data.headline || null,
      bio: parsed.data.bio,
      contactPhone: phone.display,
      normalizedPhone: phone.e164,
      contactEmail: parsed.data.contactEmail || user.email,
      websiteUrl: parsed.data.websiteUrl || null,
      city: geo?.city ?? null,
      state: geo?.state ?? null,
      zip: geo?.zip ?? null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      status: "active",
      createdByUserId: user.id,
      claimedAt: now,
      selfListedAt: now,
    })
    .returning({ slug: providers.slug });

  redirect(`/p/${created.slug}?listed=1`);
}
