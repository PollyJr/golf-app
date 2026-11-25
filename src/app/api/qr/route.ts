import QRCode from "qrcode";
import { z } from "zod";
import { errorResponse } from "@/server/http/route";
import { externalOrigin } from "@/server/security";

// Only links into our own public pages can be encoded, so this endpoint
// cannot be used as a general-purpose QR generator.
const querySchema = z.object({
  path: z.string().regex(/^\/(live|join|board|r|p)\/[A-Za-z0-9_-]{4,200}$/),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const { path } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const svg = await QRCode.toString(`${externalOrigin(request)}${path}`, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#0f2a1e", light: "#ffffff" },
    });
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
