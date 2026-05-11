import { describe, test, expect } from 'vitest';

function toOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  return Number(value);
}

describe('Edit Pepper Logic', () => {

  test('returns undefined for empty string', () => {
    expect(toOptionalNumber('')).toBeUndefined();
  });

  test('converts valid number string', () => {
    expect(toOptionalNumber('25')).toBe(25);
  });

  test('converts decimal string', () => {
    expect(toOptionalNumber('12.5')).toBe(12.5);
  });

  test('ignores spaces', () => {
    expect(toOptionalNumber('   ')).toBeUndefined();
  });

});