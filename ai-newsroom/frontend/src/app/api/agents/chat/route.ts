import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type RequestInitWithDuplex = RequestInit & { duplex: "half" };

export async function POST(req: NextRequest) {
  const backendUrl = (process.env.INTERNAL_API_URL || "http://localhost:8000") + "/api/agents/chat";
  
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "text/event-stream");
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }

  try {
    const init: RequestInitWithDuplex = {
      method: "POST",
      headers,
      body: req.body,
      duplex: "half",
    };

    const response = await fetch(backendUrl, init);

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
    console.error("Agent Chat Proxy Error:", error);
    const detail = error instanceof Error ? error.message : "Unknown proxy error";
    return new Response(JSON.stringify({ message: "Proxy error", detail }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
