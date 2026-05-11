import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const { id, action } = await params;
  
  // Extract search params (like ?reviewer_id=...)
  const { search } = new URL(req.url);
  
  const backendUrl = (process.env.INTERNAL_API_URL || "http://localhost:8000") + `/api/stream/${id}/${action}${search}`;
  
  const headers = new Headers();
  headers.set("Accept", "text/event-stream");
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }

  try {
    const response = await fetch(backendUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "application/json",
        },
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error(`Stream Proxy Error (${action}):`, error);
    const detail = error instanceof Error ? error.message : "Unknown proxy error";
    return new Response(JSON.stringify({ message: "Proxy error", detail }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
