export interface DateRange {
  start: Date;
  end: Date;
}

const END_OF_DAY_MS = 24 * 60 * 60 * 1000 - 1;

/** UTC day boundaries for a "YYYY-MM-DD" string. */
export function dayRange(dateStr: string): DateRange {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + END_OF_DAY_MS) };
}

/** UTC month boundaries for a "YYYY-MM" string. */
export function monthRange(monthStr: string): DateRange {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthString(): string {
  return new Date().toISOString().slice(0, 7);
}
