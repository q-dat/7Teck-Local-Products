import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const API_GUARD_ADMIN_SESSION_COOKIE = "api_guard_admin_session";
export const API_GUARD_ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

const getAdminToken = (): string =>
  process.env.API_GUARD_ADMIN_TOKEN?.trim() ?? "";

const constantTimeEquals = (first: string, second: string): boolean => {
  const firstBuffer = Buffer.from(first, "utf8");
  const secondBuffer = Buffer.from(second, "utf8");

  if (firstBuffer.length === 0 || firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  return timingSafeEqual(firstBuffer, secondBuffer);
};

export const isValidApiGuardAdminToken = (token: string): boolean => {
  const expectedToken = getAdminToken();
  if (!expectedToken || !token) return false;
  return constantTimeEquals(expectedToken, token);
};

const signSessionPayload = (payload: string): string => {
  const secret = getAdminToken();
  if (!secret) throw new Error("Thiếu API_GUARD_ADMIN_TOKEN trên server.");

  return createHmac("sha256", secret).update(payload).digest("base64url");
};

export const createApiGuardAdminSession = (): string => {
  const issuedAt = Math.floor(Date.now() / 1_000);
  const nonce = randomBytes(18).toString("base64url");
  const payload = `${issuedAt}.${nonce}`;
  return `${payload}.${signSessionPayload(payload)}`;
};

const getCookieValue = (
  request: Request,
  cookieName: string,
): string | null => {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const cookiePart of cookieHeader.split(";")) {
    const separatorIndex = cookiePart.indexOf("=");
    if (separatorIndex < 0) continue;

    const name = cookiePart.slice(0, separatorIndex).trim();
    if (name !== cookieName) continue;

    return cookiePart.slice(separatorIndex + 1).trim();
  }

  return null;
};

export const isValidApiGuardAdminSession = (request: Request): boolean => {
  if (!getAdminToken()) return false;

  const sessionValue = getCookieValue(request, API_GUARD_ADMIN_SESSION_COOKIE);
  if (!sessionValue) return false;

  const [issuedAtValue, nonce, providedSignature, ...extraParts] =
    sessionValue.split(".");
  if (!issuedAtValue || !nonce || !providedSignature || extraParts.length > 0) {
    return false;
  }

  const issuedAt = Number(issuedAtValue);
  const now = Math.floor(Date.now() / 1_000);
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt > now + 60 ||
    now - issuedAt > API_GUARD_ADMIN_SESSION_TTL_SECONDS
  ) {
    return false;
  }

  const payload = `${issuedAtValue}.${nonce}`;
  const expectedSignature = signSessionPayload(payload);
  return constantTimeEquals(expectedSignature, providedSignature);
};

export const isApiGuardAdminAuthorized = (request: Request): boolean => {
  const authorization = request.headers.get("authorization") ?? "";
  const providedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  return (
    isValidApiGuardAdminToken(providedToken) ||
    isValidApiGuardAdminSession(request)
  );
};
