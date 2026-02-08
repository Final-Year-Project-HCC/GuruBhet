export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function buildUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  return base ? `${base}${path}` : path;
}