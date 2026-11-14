import { ImageResponse } from "next/og";

const SIZES = new Set([192, 512]);

/**
 * App icons, drawn rather than shipped as files so there is no binary asset to
 * keep in sync. `?maskable=1` pads the artwork into the safe zone, because
 * Android crops a maskable icon to whatever shape the launcher uses.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await params;
  const size = Number(raw);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });

  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const inner = Math.round(size * (maskable ? 0.58 : 0.72));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#12866f" : "#fbf8f4",
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: Math.round(inner * 0.26),
            background: "linear-gradient(135deg, #1fa78b 0%, #106b5b 100%)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(inner * 0.56),
            fontWeight: 700,
          }}
        >
          ♥
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
