export function formatBrazilianPhone(phone) {
  if (!phone) return null;

  const cleaned = String(phone).replace(/\D/g, '');
  const local =
    cleaned.length === 13 && cleaned.startsWith('55')
      ? cleaned.slice(2)
      : cleaned;

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }

  return phone;
}
