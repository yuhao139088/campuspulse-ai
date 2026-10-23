const api = "https://api.github.com";

export const githubBindCookie = "campuspulse-github-bind";

export function githubRedirectUri() {
  const base = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + "/api/auth/callback/github";
}

export async function githubEmailVerified(accessToken: string, email: string) {
  if (!accessToken) return false;
  try {
    const response = await fetch(api + "/user/emails", { headers: { Authorization: "Bearer " + accessToken, Accept: "application/vnd.github+json", "User-Agent": "campuspulse-ai" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return false;
    const entries: unknown = await response.json();
    return Array.isArray(entries) && entries.some((entry) => !!entry && typeof entry === "object" && typeof (entry as { email?: unknown }).email === "string" && ((entry as { email: string }).email.toLowerCase() === email) && (entry as { verified?: unknown }).verified === true);
  } catch { return false; }
}

export async function githubLoginById(providerAccountId: string) {
  if (!/^\d+$/.test(providerAccountId)) return null;
  try {
    const response = await fetch(api + "/user/" + providerAccountId, { headers: { Accept: "application/vnd.github+json", "User-Agent": "campuspulse-ai" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const profile = (await response.json()) as { login?: unknown };
    return typeof profile.login === "string" ? profile.login : null;
  } catch { return null; }
}