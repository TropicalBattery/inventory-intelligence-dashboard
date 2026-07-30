/**
 * Public app origin for auth redirects (password reset, etc.).
 * Set NEXT_PUBLIC_SITE_URL in env (no trailing slash), e.g. http://localhost:3000
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  return raw.replace(/\/$/, "");
}

/** Landing path for password-recovery emails. */
export const UPDATE_PASSWORD_PATH = "/update-password";

export function getUpdatePasswordRedirectUrl(): string {
  const base = getSiteUrl();
  if (!base) {
    throw new Error("NEXT_PUBLIC_SITE_URL is not configured");
  }
  return `${base}${UPDATE_PASSWORD_PATH}`;
}
