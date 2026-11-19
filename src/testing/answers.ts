export function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function list(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

export function found(value: unknown): string {
  if (value === undefined) {
    return 'missing';
  }
  return typeof value === 'number' ? String(value) : JSON.stringify(value);
}

export function textIssue(
  path: string,
  value: unknown,
  rule: string,
): string | null {
  return typeof value === 'string' && value !== ''
    ? null
    : `${path} is ${found(value)}. ${rule}`;
}
