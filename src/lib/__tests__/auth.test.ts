import { describe, test, expect, vi, beforeEach } from "vitest";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("jose", () => ({ jwtVerify: vi.fn(), SignJWT: vi.fn() }));

const mockCookies = vi.mocked(cookies);
const mockJwtVerify = vi.mocked(jwtVerify);

function makeCookieStore(token?: string) {
  return {
    get: (_name: string) => (token ? { value: token } : undefined),
  };
}

describe("getSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns null when auth-token cookie is absent", async () => {
    mockCookies.mockResolvedValue(makeCookieStore() as never);

    const { getSession } = await import("@/lib/auth");
    const result = await getSession();

    expect(result).toBeNull();
    expect(mockJwtVerify).not.toHaveBeenCalled();
  });

  test("returns session payload when token is valid", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const payload = { userId: "user-1", email: "user@example.com", expiresAt };

    mockCookies.mockResolvedValue(makeCookieStore("valid.jwt.token") as never);
    mockJwtVerify.mockResolvedValue({ payload } as never);

    const { getSession } = await import("@/lib/auth");
    const result = await getSession();

    expect(result).toEqual(payload);
    expect(mockJwtVerify).toHaveBeenCalledOnce();
    expect(mockJwtVerify.mock.calls[0][0]).toBe("valid.jwt.token");
  });

  test("returns null when jwtVerify throws (expired or invalid token)", async () => {
    mockCookies.mockResolvedValue(makeCookieStore("bad.jwt.token") as never);
    mockJwtVerify.mockRejectedValue(new Error("JWTExpired"));

    const { getSession } = await import("@/lib/auth");
    const result = await getSession();

    expect(result).toBeNull();
  });
});
