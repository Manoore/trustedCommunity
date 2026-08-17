"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { reportSchema, zodToState, type ActionState } from "@/lib/validation";

export async function createReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();

  const parsed = reportSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason"),
    details: formData.get("details") ?? "",
  });
  if (!parsed.success) return zodToState(parsed.error);

  // One open report per person per target keeps the queue from being flooded.
  if (user) {
    const existing = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.targetId, parsed.data.targetId),
          eq(reports.reporterUserId, user.id),
          eq(reports.status, "open"),
        ),
      )
      .limit(1);
    if (existing.length) {
      return { ok: true, message: "You already reported this. We are looking at it." };
    }
  }

  await db.insert(reports).values({
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    reporterUserId: user?.id ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
  });

  revalidatePath("/admin/reports");
  return { ok: true, message: "Reported. An admin will review it." };
}

export async function resolveReportAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return;

  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["actioned", "dismissed"].includes(status)) return;

  await db
    .update(reports)
    .set({
      status: status as "actioned" | "dismissed",
      resolvedByUserId: user.id,
      resolvedAt: new Date(),
    })
    .where(eq(reports.id, reportId));

  revalidatePath("/admin/reports");
}
