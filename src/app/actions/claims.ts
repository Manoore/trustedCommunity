"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { claimRequests, providers, recommendations } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { claimReceivedEmail, sendEmail } from "@/lib/email";
import { rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import {
  claimRequestSchema,
  zodToState,
  type ActionState,
} from "@/lib/validation";

/**
 * Anyone can file this, signed in or not.
 *
 * Someone listed as a babysitter by a neighbour never chose to be in this
 * system, so the way out cannot require them to create an account first.
 */
export async function requestClaimAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const limit = await rateLimit("claim");
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = claimRequestSchema.safeParse({
    providerId: formData.get("providerId"),
    kind: formData.get("kind"),
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return zodToState(parsed.error);

  const [provider] = await db
    .select({ id: providers.id, displayName: providers.displayName })
    .from(providers)
    .where(eq(providers.id, parsed.data.providerId))
    .limit(1);
  if (!provider) return { ok: false, message: "That profile no longer exists." };

  await db.insert(claimRequests).values({
    providerId: provider.id,
    kind: parsed.data.kind,
    contactEmail: parsed.data.contactEmail || null,
    contactPhone: parsed.data.contactPhone || null,
    message: parsed.data.message || null,
  });

  // A removal request suppresses the profile straight away. Someone who wants
  // out should not stay visible while a human works through a queue; if the
  // request turns out to be bogus an admin can reject it and restore them.
  if (parsed.data.kind === "removal") {
    await db
      .update(providers)
      .set({ removalRequestedAt: new Date(), hiddenAt: new Date() })
      .where(eq(providers.id, provider.id));
  }

  if (parsed.data.contactEmail) {
    await sendEmail(
      claimReceivedEmail(parsed.data.contactEmail, provider.displayName),
    );
  }

  revalidatePath("/admin/claims");
  return {
    ok: true,
    message:
      parsed.data.kind === "removal"
        ? "This profile is now hidden and an admin will confirm the removal."
        : "Request received. An admin will get in touch to verify it is you.",
  };
}

/** Admin: confirm a removal, or reject it and restore the profile. */
export async function resolveClaimAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return;

  const claimId = String(formData.get("claimId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!["resolved", "rejected"].includes(decision)) return;

  const [claim] = await db
    .update(claimRequests)
    .set({
      status: decision as "resolved" | "rejected",
      resolvedByUserId: user.id,
      resolvedAt: new Date(),
    })
    .where(eq(claimRequests.id, claimId))
    .returning({ providerId: claimRequests.providerId, kind: claimRequests.kind });

  if (!claim) return;

  if (claim.kind === "removal") {
    if (decision === "resolved") {
      // Confirmed: drop the recommendations too, not just the profile.
      await db
        .delete(recommendations)
        .where(eq(recommendations.providerId, claim.providerId));
      await db
        .update(providers)
        .set({ status: "suspended", hiddenAt: new Date() })
        .where(eq(providers.id, claim.providerId));
    } else {
      await db
        .update(providers)
        .set({ hiddenAt: null, removalRequestedAt: null })
        .where(eq(providers.id, claim.providerId));
    }
  }

  if (claim.kind === "claim" && decision === "resolved") {
    await db
      .update(providers)
      .set({ claimedAt: new Date() })
      .where(eq(providers.id, claim.providerId));
  }

  revalidatePath("/admin/claims");
}
