export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('00') ? digits.slice(2) : digits
}

export function samePhone(left: string, right: string): boolean {
  return normalizePhone(left) === normalizePhone(right)
}
