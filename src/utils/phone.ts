export function normalizePhone(phone: string): string {
  return String(phone || '').replace(/[^0-9]/g, '').trim();
}

export function phoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const variants = new Set<string>([phone, normalized]);

  if (normalized.startsWith('34') && normalized.length > 9) {
    variants.add(normalized.slice(2));
  }

  if (normalized.length === 9) {
    variants.add(`34${normalized}`);
  }

  return [...variants].filter(Boolean);
}
