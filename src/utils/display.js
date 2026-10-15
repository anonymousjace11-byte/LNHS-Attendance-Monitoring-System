export function displayValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return !trimmed || trimmed.toLowerCase() === 'n/a' ? '—' : value;
  }
  return value;
}
