import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const REFRESH_COOKIE = "makeup_refresh";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { message: "Sessão expirada", error: "Unauthorized", statusCode: 401 },
      { status: 401 },
    );
  }

  const backend = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { cookie: `${REFRESH_COOKIE}=${encodeURIComponent(token)}` },
  });

  const payload = await backend.json().catch(() => ({}));

  if (!backend.ok) {
    return NextResponse.json(payload, { status: backend.status });
  }

  return NextResponse.json(payload, { status: backend.status });
}