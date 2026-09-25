export function normalizeStringEnum(value: unknown): string {
  return typeof value === 'string' ? value : 'UNKNOWN';
}

export function formatProtobufTimestamp(timestamp: unknown): string | undefined {
  if (!timestamp || typeof timestamp !== 'object') return undefined;

  const record = timestamp as { seconds?: unknown; nanos?: unknown };
  const seconds = Number(record.seconds ?? 0);
  const nanos = Number(record.nanos ?? 0);
  if (!Number.isFinite(seconds)) return undefined;

  const millis = seconds * 1000 + Math.floor(nanos / 1_000_000);
  return new Date(millis).toISOString();
}

export function toInt64Number(value: unknown, fallback = 0): number {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toInt64String(value: unknown, fallback = '0'): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') {
    const str = String(value);
    if (/^-?\d+$/.test(str)) return str;
  }
  return fallback;
}

export function normalizeNamedEnum(
  value: unknown,
  nameByNumber: Record<number, string>
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && nameByNumber[value] !== undefined) {
    return nameByNumber[value];
  }
  if (typeof value === 'number') return String(value);
  return 'UNKNOWN';
}

export function normalizeQuotaType(value: unknown): number | undefined {
  const enumMap: Record<string, number> = {
    TYPE_UNSPECIFIED: 0,
    INDIVIDUAL_USER_QUOTA: 1,
    INDIVIDUAL_GROUP_QUOTA: 2,
    DEFAULT_USER_QUOTA: 3,
    DEFAULT_GROUP_QUOTA: 4,
  };

  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Object.values(enumMap).includes(value)) return value;
  if (typeof value === 'string') {
    const mapped = enumMap[value.trim().toUpperCase()];
    if (mapped !== undefined) return mapped;
  }
  return undefined;
}
