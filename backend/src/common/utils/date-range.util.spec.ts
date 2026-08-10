import { dayRange, monthRange } from './date-range.util';

describe('dayRange', () => {
  it('spans exactly one UTC day', () => {
    const { start, end } = dayRange('2026-08-10');
    expect(start.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-10T23:59:59.999Z');
  });
});

describe('monthRange', () => {
  it('spans a 31-day month', () => {
    const { start, end } = monthRange('2026-08');
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-31T23:59:59.999Z');
  });

  it('spans a 28-day February in a non-leap year', () => {
    const { start, end } = monthRange('2026-02');
    expect(start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-02-28T23:59:59.999Z');
  });

  it('spans a 29-day February in a leap year', () => {
    const { end } = monthRange('2028-02');
    expect(end.toISOString()).toBe('2028-02-29T23:59:59.999Z');
  });
});
