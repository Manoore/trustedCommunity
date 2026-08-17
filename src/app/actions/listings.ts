"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, listingMedia, listings, verifications } from "@/db/schema";
import { assertProviderAccess, getCurrentUser } from "@/lib/auth";
import { lookupZip } from "@/lib/geo";
import { uniqueSlug } from "@/lib/slug";
import { saveImage } from "@/lib/uploads";
import { listingSchema, zodToState, type ActionState } from "@/lib/validation";

const MAX_IMAGES = 8;

function readListingForm(formData: FormData) {
  return {
    categoryId: formData.get("categoryId"),
    title: formData.get("title"),
    description: formData.get("description"),
    priceType: formData.get("priceType"),
    priceMin: formData.get("priceMin") ?? "",
    priceMax: formData.get("priceMax") ?? "",
    remoteOk: formData.get("remoteOk") === "on",
    zip: formData.get("zip") ?? "",
    serviceRadiusMiles: formData.get("serviceRadiusMiles") || 25,
    licenseNumber: formData.get("licenseNumber") ?? "",
    licenseState: formData.get("licenseState") ?? "",
  };
}

function dollarsToCents(value: string | undefined) {
  if (!value) return null;
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export async function createListingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/listings/new");

  const providerId = String(formData.get("providerId") ?? "");
  try {
    await assertProviderAccess(user.id, providerId, ["owner", "manager"]);
  } catch {
    return { ok: false, message: "You cannot post listings for this account." };
  }

  const parsed = listingSchema.safeParse(readListingForm(formData));
  if (!parsed.success) return zodToState(parsed.error);

  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, parsed.data.categoryId))
    .limit(1);

  if (!category) return { ok: false, fieldErrors: { categoryId: ["Pick a category."] } };
  if (category.restricted) {
    return {
      ok: false,
      message: `${category.name} is not accepted on this marketplace. See the content policy for why.`,
    };
  }

  // Licensed trades need a number on file, and stay out of search until an admin
  // has checked it. Advertising unlicensed work is the liability we most want to
  // avoid carrying.
  if (category.licenseRequired && !parsed.data.licenseNumber) {
    return {
      ok: false,
      fieldErrors: {
        licenseNumber: [
          `${category.name} requires a state licence number before the listing can go live.`,
        ],
      },
    };
  }

  const geo = parsed.data.remoteOk ? null : lookupZip(parsed.data.zip);
  if (!parsed.data.remoteOk && !geo) {
    return { ok: false, fieldErrors: { zip: ["We do not recognise that ZIP code."] } };
  }

  const status = category.licenseRequired ? "pending" : "active";

  const [listing] = await db
    .insert(listings)
    .values({
      providerId,
      categoryId: category.id,
      title: parsed.data.title,
      slug: uniqueSlug(parsed.data.title),
      description: parsed.data.description,
      priceType: parsed.data.priceType,
      priceMinCents: dollarsToCents(parsed.data.priceMin),
      priceMaxCents: dollarsToCents(parsed.data.priceMax),
      status,
      remoteOk: Boolean(parsed.data.remoteOk),
      zip: geo?.zip ?? null,
      city: geo?.city ?? null,
      state: geo?.state ?? null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      serviceRadiusMiles: parsed.data.remoteOk ? 3000 : parsed.data.serviceRadiusMiles,
      licenseNumber: parsed.data.licenseNumber || null,
      licenseState: parsed.data.licenseState || null,
    })
    .returning({ id: listings.id });

  if (category.licenseRequired) {
    await db.insert(verifications).values({
      providerId,
      kind: "license",
      licenseNumber: parsed.data.licenseNumber || null,
      licenseState: parsed.data.licenseState || null,
      notes: `Auto-created for listing "${parsed.data.title}" in ${category.name}.`,
    });
  }

  await saveUploads(formData, listing.id, 0);

  revalidatePath("/dashboard/listings");
  redirect(`/dashboard/listings/${listing.id}/edit?created=1`);
}

export async function updateListingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const listingId = String(formData.get("listingId") ?? "");
  const [existing] = await db
    .select({ providerId: listings.providerId, status: listings.status })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!existing) return { ok: false, message: "That listing no longer exists." };

  try {
    await assertProviderAccess(user.id, existing.providerId, ["owner", "manager"]);
  } catch {
    return { ok: false, message: "You cannot edit this listing." };
  }

  const parsed = listingSchema.safeParse(readListingForm(formData));
  if (!parsed.success) return zodToState(parsed.error);

  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, parsed.data.categoryId))
    .limit(1);
  if (!category || category.restricted) {
    return { ok: false, fieldErrors: { categoryId: ["Pick an accepted category."] } };
  }
  if (category.licenseRequired && !parsed.data.licenseNumber) {
    return {
      ok: false,
      fieldErrors: {
        licenseNumber: [`${category.name} requires a state licence number.`],
      },
    };
  }

  const geo = parsed.data.remoteOk ? null : lookupZip(parsed.data.zip);
  if (!parsed.data.remoteOk && !geo) {
    return { ok: false, fieldErrors: { zip: ["We do not recognise that ZIP code."] } };
  }

  const count = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listingMedia)
    .where(eq(listingMedia.listingId, listingId));

  await db
    .update(listings)
    .set({
      categoryId: category.id,
      title: parsed.data.title,
      description: parsed.data.description,
      priceType: parsed.data.priceType,
      priceMinCents: dollarsToCents(parsed.data.priceMin),
      priceMaxCents: dollarsToCents(parsed.data.priceMax),
      remoteOk: Boolean(parsed.data.remoteOk),
      zip: geo?.zip ?? null,
      city: geo?.city ?? null,
      state: geo?.state ?? null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      serviceRadiusMiles: parsed.data.remoteOk ? 3000 : parsed.data.serviceRadiusMiles,
      licenseNumber: parsed.data.licenseNumber || null,
      licenseState: parsed.data.licenseState || null,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId));

  const uploadError = await saveUploads(formData, listingId, Number(count[0]?.n ?? 0));

  revalidatePath(`/dashboard/listings/${listingId}/edit`);
  revalidatePath("/dashboard/listings");
  return uploadError
    ? { ok: false, message: uploadError }
    : { ok: true, message: "Listing saved." };
}

/** Returns an error string, or null when every file was stored. */
async function saveUploads(formData: FormData, listingId: string, offset: number) {
  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!files.length) return null;
  if (offset + files.length > MAX_IMAGES) {
    return `A listing can hold ${MAX_IMAGES} images.`;
  }

  let sortOrder = offset;
  for (const file of files) {
    const result = await saveImage(file);
    if (!result.ok) return result.error;
    await db.insert(listingMedia).values({
      listingId,
      url: result.url,
      sortOrder: sortOrder++,
    });
  }
  return null;
}

export async function deleteMediaAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const mediaId = String(formData.get("mediaId") ?? "");
  const [media] = await db
    .select({ listingId: listingMedia.listingId, providerId: listings.providerId })
    .from(listingMedia)
    .innerJoin(listings, eq(listings.id, listingMedia.listingId))
    .where(eq(listingMedia.id, mediaId))
    .limit(1);

  if (!media) return;
  try {
    await assertProviderAccess(user.id, media.providerId, ["owner", "manager"]);
  } catch {
    return;
  }

  await db.delete(listingMedia).where(eq(listingMedia.id, mediaId));
  revalidatePath(`/dashboard/listings/${media.listingId}/edit`);
}

export async function setListingStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const listingId = String(formData.get("listingId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["active", "paused", "draft"].includes(status)) return;

  const [listing] = await db
    .select({ providerId: listings.providerId, status: listings.status })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!listing) return;

  try {
    await assertProviderAccess(user.id, listing.providerId, ["owner", "manager"]);
  } catch {
    return;
  }

  // A listing an admin suspended, or one still pending licence review, is not
  // something the provider can flip back on themselves.
  if (listing.status === "suspended" || listing.status === "pending") return;

  await db
    .update(listings)
    .set({ status: status as "active" | "paused" | "draft", updatedAt: new Date() })
    .where(eq(listings.id, listingId));

  revalidatePath("/dashboard/listings");
}

export async function deleteListingAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const listingId = String(formData.get("listingId") ?? "");
  const [listing] = await db
    .select({ providerId: listings.providerId })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!listing) return;

  try {
    await assertProviderAccess(user.id, listing.providerId, ["owner"]);
  } catch {
    return;
  }

  await db
    .delete(listings)
    .where(and(eq(listings.id, listingId), eq(listings.providerId, listing.providerId)));

  revalidatePath("/dashboard/listings");
  redirect("/dashboard/listings");
}
