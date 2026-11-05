import { NextResponse } from "next/server";
import {
  API_GUARD_ADMIN_SESSION_COOKIE,
  API_GUARD_ADMIN_SESSION_TTL_SECONDS,
  createApiGuardAdminSession,
  isValidApiGuardAdminToken,
} from "@/lib/api-guard/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

function readBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function unauthorizedResponse(): Response {
  const configured = Boolean(process.env.API_GUARD_ADMIN_TOKEN?.trim());
  return NextResponse.json(
    {
      ok: false,
      code: configured ? "UNAUTHORIZED" : "API_GUARD_NOT_CONFIGURED",
      message: configured
        ? "API Guard Admin Token không hợp lệ."
        : "Thiếu API_GUARD_ADMIN_TOKEN trên server.",
    },
    {
      status: configured ? 401 : 503,
      headers: NO_STORE_HEADERS,
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  const token = readBearerToken(request);
  if (!isValidApiGuardAdminToken(token)) return unauthorizedResponse();

  const response = NextResponse.json(
    {
      ok: true,
      message: "Xác thực quản trị thành công.",
      expiresIn: API_GUARD_ADMIN_SESSION_TTL_SECONDS,
    },
    { headers: NO_STORE_HEADERS },
  );

  response.cookies.set({
    name: API_GUARD_ADMIN_SESSION_COOKIE,
    value: createApiGuardAdminSession(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin/api-guard",
    maxAge: API_GUARD_ADMIN_SESSION_TTL_SECONDS,
  });

  return response;
}

export async function DELETE(): Promise<Response> {
  const response = NextResponse.json(
    { ok: true, message: "Đã kết thúc phiên quản trị." },
    { headers: NO_STORE_HEADERS },
  );

  response.cookies.set({
    name: API_GUARD_ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin/api-guard",
    maxAge: 0,
  });

  return response;
}
