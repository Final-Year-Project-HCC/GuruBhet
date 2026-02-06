export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function isValidNepalMobile(mobile: string) {
  return /^(97|98)\d{8}$/.test(mobile);
}
export function maskMobile(mobile?: string) {
  if (!mobile) return "Unknown";
  return `${mobile.slice(0, 2)}******${mobile.slice(-2)}`;
}