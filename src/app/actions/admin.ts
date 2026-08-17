"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { listings, providers, verifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

async function requireAdminUser() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

/**
 * Approving a licence is what releases the provider's pending listings. Until
 * an admin has actually looked at the number, licensed-trade listings stay out
 * of search — that is the point of the pending state.
 */
export async function decideVerificationAction(formData: FormData) {
  const admin = await requireAdminUser();
  if (!admin) return;

  const verificationId = String(formData.get("verificationId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!["approved", "rejected"].includes(decision)) return;

  const [verification] = await db
    .update(verifications)
    .set({
      status: decision as "approved" | "rejected",
      notes,
      reviewedByUserId: admin.id,
      reviewedAt: new Date(),
    })
    .where(eq(verifications.id, verificationId))
    .returning({ providerId: verifications.providerId, kind: verifications.kind });

  if (!verification) return;

  if (decision === "approved") {
    await db
      .update(providers)
      .set({ verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(providers.id, verification.providerId));

    await db
      .update(listings)
      .set({ status: "active", rejectionReason: null, updatedAt: new Date() })
      .where(
        and(
          eq(listings.providerId, verification.providerId),
          eq(listings.status, "pending"),
        ),
      );
  } else {
    await db
      .update(listings)
      .set({
        status: "rejected",
        rejectionReason:
          notes ?? "We could not verify the licence number on this listing.",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(listings.providerId, verification.providerId),
          eq(listings.status, "pending"),
        ),
      );
  }

  revalidatePath("/admin/verifications");
  revalidatePath("/admin");
}

export async function setProviderStatusAction(formData: FormData) {
  const admin = await requireAdminUser();
  if (!admin) return;

  const providerId = String(formData.get("providerId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!["active", "suspended"].includes(status)) return;

  await db
    .update(providers)
    .set({
      status: status as "active" | "suspended",
      suspendedReason: status === "suspended" ? reason : null,
      updatedAt: new Date(),
    })
    .where(eq(providers.id, providerId));

  revalidatePath("/admin/providers");
  revalidatePath("/admin/reports");
}

export async function setListingModerationAction(formData: FormData) {
  const admin = await requireAdminUser();
  if (!admin) return;

  const listingId = String(formData.get("listingId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!["active", "suspended", "rejected"].includes(status)) return;

  await db
    .update(listings)
    .set({
      status: status as "active" | "suspended" | "rejected",
      rejectionReason: status === "active" ? null : reason,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId));

  revalidatePath("/admin/listings");
  revalidatePath("/admin/reports");
}
