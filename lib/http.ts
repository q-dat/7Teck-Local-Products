import { NextResponse } from "next/server";

export const apiError = (error: unknown, status = 500) => {
  const message = error instanceof Error ? error.message : "Lỗi máy chủ không xác định";
  return NextResponse.json({ ok: false, message }, { status });
};

export const jsonNoStore = (body: unknown, init?: ResponseInit) => {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
};
