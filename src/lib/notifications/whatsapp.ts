export function buildWhatsAppSendUrl(phone: string, body: string): string {
  const digits = phone.replace(/\D/g, "")
  const normalized = digits.startsWith("63")
    ? digits
    : digits.startsWith("0")
      ? `63${digits.slice(1)}`
      : digits
  return `https://wa.me/${normalized}?text=${encodeURIComponent(body)}`
}
