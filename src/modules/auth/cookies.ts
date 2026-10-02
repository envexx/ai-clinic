export const GUEST_COOKIE = "ai_clinic_guest";
export const STAFF_COOKIE = "ai_clinic_staff";

const isProduction = process.env.NODE_ENV === "production";

export const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
};

export function cookieOptions(maxAgeSeconds: number) {
  return { ...baseCookieOptions, maxAge: maxAgeSeconds };
}
