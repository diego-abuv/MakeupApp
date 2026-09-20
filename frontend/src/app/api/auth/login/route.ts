import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const REFRESH_COOKIE = "makeup_refresh";
const REFRESH_MAX_AGE_SECONDS = 2.5 * 60 * 60;

function extrairRefreshToken(res: Response): string | null {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/(?:^|;\s*)makeup_refresh=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ message: "Corpo inválido" }, { status: 400 });
  }

  const backend = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: body.username ?? "",
      password: body.password ?? "",
    }),
  });

  const payload = await backend.json().catch(() => ({}));

  if (!backend.ok) {
    return NextResponse.json(payload, { status: backend.status });
  }

  const response = NextResponse.json(payload, { status: backend.status });
  const refresh = extrairRefreshToken(backend);
  if (refresh) {
    response.cookies.set(REFRESH_COOKIE, refresh, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: REFRESH_MAX_AGE_SECONDS,
    });
  }
  return response;
}
