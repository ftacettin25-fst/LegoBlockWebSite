const KEY = "g2b_guest_token";

export function getGuestToken(): string {
  if (typeof window === "undefined") return "guest";
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(KEY, token);
  }
  return token;
}
