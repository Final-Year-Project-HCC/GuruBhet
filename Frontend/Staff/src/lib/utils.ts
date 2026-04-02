export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function buildUrl(path: string) {
  const base = "https://api.gurubhet.tech/api/v1";
  return `${base}${path}`;
}