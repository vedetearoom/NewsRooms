import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const backendBase = (
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

export async function POST(req: NextRequest) {
  const backendUrl = `${backendBase}/api/generate-image`;
  const headers = new Headers();
  headers.set("Content-Type", req.headers.get("Content-Type") || "application/json");

  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }

  try {
    const response = await fetch(backendUrl, {
      method: "POST",
      headers,
      body: await req.text(),
      signal: AbortSignal.timeout(180_000),
    });

    const contentType = response.headers.get("Content-Type") || "application/json";
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": contentType },
    });
  } catch {
    return Response.json({
      ok: false,
      error_code: "IMAGE_PROVIDER_UNAVAILABLE",
    });
  }
}
