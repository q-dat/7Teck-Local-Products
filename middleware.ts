import { NextResponse, type NextRequest } from "next/server";
import { getApiGuardState } from "@/lib/api-guard/store";
import { API_GUARD_FAKE_TABLE } from "./lib/api-guard/fake-table";

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Authorization, Cookie",
};

function isGuardInfrastructureRoute(pathname: string): boolean {
  return (
    pathname === "/api/admin/api-guard" ||
    pathname === "/api/admin/api-guard/session" ||
    pathname === "/api/guard-status" ||
    pathname === "/api/guard-events"
  );
}

export async function middleware(request: NextRequest): Promise<Response> {
  const { pathname } = request.nextUrl;
  if (isGuardInfrastructureRoute(pathname)) return NextResponse.next();

  try {
    const state = await getApiGuardState();
    if (!state.enabled) return NextResponse.next();

    return NextResponse.json(
      {
        ok: false,
        code: "API_GUARD_ACTIVE",
        mode: "decoy",
        message: "API đang ở chế độ bảo vệ dữ liệu.",
        fakeTable: API_GUARD_FAKE_TABLE,
        state: {
          enabled: true,
          revision: state.revision,
          updatedAt: state.updatedAt,
        },
      },
      { status: 423, headers: NO_STORE_HEADERS },
    );
  } catch (error: unknown) {
    console.error(
      "[api-guard] Cannot verify guard state; request blocked:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      {
        ok: false,
        code: "API_GUARD_UNAVAILABLE",
        message: "Không thể xác minh trạng thái bảo vệ. API tạm thời bị khóa.",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}

export const config = {
  matcher: ["/api/:path*"],
  runtime: "nodejs",
};
