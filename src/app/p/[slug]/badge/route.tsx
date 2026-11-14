import { ImageResponse } from "next/og";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { getPublicVouchCount } from "@/lib/recommendations";

/**
 * An embeddable "Recommended on Trusted By" badge for a business's own website
 * or shop window. Free on purpose: selling the badge would make the trust it
 * signals worth less.
 *
 * It is public, so it only ever states what the recommenders themselves made
 * public. A business with no public recommendations gets a neutral badge rather
 * than a number it has not earned.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const [provider] = await db
    .select({ id: providers.id, name: providers.displayName })
    .from(providers)
    .where(and(eq(providers.slug, slug), isNull(providers.hiddenAt)))
    .limit(1);

  // A removed or unknown profile must not render a badge at all.
  if (!provider) return new Response("Not found", { status: 404 });

  const count = await getPublicVouchCount(provider.id);
  const line =
    count > 0
      ? `Recommended by ${count} ${count === 1 ? "person" : "people"}`
      : "Find us on Trusted By";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 22px",
          background: "linear-gradient(135deg, #fffaf5 0%, #ffe9e3 55%, #dff6ee 100%)",
          border: "2px solid #12866f",
          borderRadius: 18,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            background: "#12866f",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          ♥
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1c1a17" }}>{line}</div>
          <div style={{ fontSize: 15, color: "#6b6459" }}>on Trusted By · named, not anonymous</div>
        </div>
      </div>
    ),
    {
      width: 360,
      height: 84,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    },
  );
}
