import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getShareLinkByToken,
  getSharedList,
  getSharedRecommendation,
} from "@/lib/recommendations";

export const alt = "A recommendation from someone you trust";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Preview card for when a share link is pasted into a group chat. The link is
 * the growth loop, so it should look like something worth opening rather than a
 * bare URL.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);

  let heading = "Someone you trust";
  let subject = "shared a recommendation";
  let quote: string | null = null;

  if (link) {
    const [owner] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, link.userId))
      .limit(1);

    const ownerName = owner?.name ?? "Someone";

    if (link.kind === "recommendation" && link.recommendationId) {
      const rec = await getSharedRecommendation(link.recommendationId);
      if (rec) {
        heading = `${ownerName} recommends`;
        subject = rec.name;
        quote = rec.note;
      }
    } else {
      const items = await getSharedList(link.userId);
      heading = `${ownerName}'s recommendations`;
      subject = `${items.length} people worth knowing`;
      quote = items[0]?.note ?? null;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #fbf8f4 0%, #ffe1db 55%, #d5f5ea 100%)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#12866f",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            ♥
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#1c1a17" }}>
            Trusted By
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 32, color: "#e04f36", fontWeight: 600 }}>
            {heading}
          </div>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: "#1c1a17",
              lineHeight: 1.1,
            }}
          >
            {subject}
          </div>
          {quote && (
            <div
              style={{
                fontSize: 30,
                color: "#6b6459",
                fontStyle: "italic",
                marginTop: 8,
              }}
            >
              “{quote.slice(0, 110)}
              {quote.length > 110 ? "…" : ""}”
            </div>
          )}
        </div>

        <div style={{ fontSize: 26, color: "#6b6459" }}>
          Recommendations, not reviews — every one has a name on it.
        </div>
      </div>
    ),
    size,
  );
}
