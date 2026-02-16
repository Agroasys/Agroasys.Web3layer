import { ethers } from 'ethers';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function normalizeAddressOrNull(value: string): string | null {
  if (!ethers.isAddress(value)) {
    return null;
  }

  return ethers.getAddress(value);
}

export function normalizeAddressOrThrow(value: string, fieldName: string): string {
  const normalized = normalizeAddressOrNull(value);
  if (!normalized) {
    throw new Error(`${fieldName} must be a valid EVM address, received "${value}"`);
  }

  return normalized;
}

export function isZeroAddress(value: string): boolean {
  const normalized = normalizeAddressOrNull(value);
  return normalized === ZERO_ADDRESS;
}
