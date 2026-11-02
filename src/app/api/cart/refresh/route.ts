import { NextResponse } from "next/server";
import { refreshCartQuote } from "@/lib/cart/refresh";

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid bag." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await refreshCartQuote(input);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
