import { describe, test, expect } from 'vitest';

function getHeatLevel(maxHeat: number) {
  if (maxHeat <= 2500) return 'Mild';
  if (maxHeat <= 10000) return 'Medium';
  if (maxHeat <= 50000) return 'Hot';
  return 'Very Hot';
}

describe('Heat Level Filter', () => {

  test('returns Mild for low heat peppers', () => {
    expect(getHeatLevel(2000)).toBe('Mild');
  });

  test('returns Medium for medium heat peppers', () => {
    expect(getHeatLevel(8000)).toBe('Medium');
  });

  test('returns Hot for hot peppers', () => {
    expect(getHeatLevel(30000)).toBe('Hot');
  });

  test('returns Very Hot for extreme peppers', () => {
    expect(getHeatLevel(100000)).toBe('Very Hot');
  });

});