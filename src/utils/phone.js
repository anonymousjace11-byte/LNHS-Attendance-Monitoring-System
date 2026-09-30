export function normalizePhilippinePhone(value) {
  const compact = String(value || '').trim().replace(/[^\d+]/g, '');
  if (compact.startsWith('+63') && compact.length === 13) return compact;
  if (compact.startsWith('63') && compact.length === 12) return `+${compact}`;
  if (compact.startsWith('09') && compact.length === 11) return `+63${compact.slice(1)}`;
  if (compact.startsWith('9') && compact.length === 10) return `+63${compact}`;
  return compact;
}