export type CanonicalPrimitive = null | boolean | string | number;
export type CanonicalValue = CanonicalPrimitive | CanonicalValue[] | CanonicalObject;
export interface CanonicalObject {
  [key: string]: CanonicalValue;
}

function assertFiniteNumber(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error('Non-finite numbers are not supported in Ricardian canonicalization');
  }
}

function canonicalizeArray(value: unknown[]): CanonicalValue[] {
  return value.map((entry) => canonicalize(entry));
}

function canonicalizeObject(value: Record<string, unknown>): CanonicalObject {
  const sortedKeys = Object.keys(value).sort();
  const result: CanonicalObject = {};

  for (const key of sortedKeys) {
    const raw = value[key];
    if (raw === undefined) {
      continue;
    }
    result[key] = canonicalize(raw);
  }

  return result;
}

export function canonicalize(value: unknown): CanonicalValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    assertFiniteNumber(value);
    return value;
  }

  if (Array.isArray(value)) {
    return canonicalizeArray(value);
  }

  if (typeof value === 'object') {
    return canonicalizeObject(value as Record<string, unknown>);
  }

  throw new Error(`Unsupported value type in Ricardian payload: ${typeof value}`);
}

export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
