export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function isValidNepalMobile(mobile: string) {
  return /^(97|98)\d{8}$/.test(mobile);
}