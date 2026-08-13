export interface DateRange {
  start: Date;
  end: Date;
}

const END_OF_DAY_MS = 24 * 60 * 60 * 1000 - 1;
const MS_PER_MINUTE = 60 * 1000;

/**
 * Day/month boundaries and "current date" strings are computed in a fixed
 * UTC offset (REPORT_UTC_OFFSET_MINUTES, see configuration.ts) rather than
 * hardcoded UTC, so "today" lines up with the vehicle's local day instead of
 * splitting across two UTC days for any non-UTC deployment.
 */

/** Day boundaries for a "YYYY-MM-DD" string, in the given UTC offset (minutes). */
export function dayRange(dateStr: string, offsetMinutes = 0): DateRange {
  const start = new Date(
    new Date(`${dateStr}T00:00:00.000Z`).getTime() - offsetMinutes * MS_PER_MINUTE,
  );
  return { start, end: new Date(start.getTime() + END_OF_DAY_MS) };
}

/** Month boundaries for a "YYYY-MM" string, in the given UTC offset (minutes). */
export function monthRange(monthStr: string, offsetMinutes = 0): DateRange {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(
    Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - offsetMinutes * MS_PER_MINUTE,
  );
  const end = new Date(
    Date.UTC(year, month, 0, 23, 59, 59, 999) - offsetMinutes * MS_PER_MINUTE,
  );
  return { start, end };
}

export function todayDateString(offsetMinutes = 0): string {
  return new Date(Date.now() + offsetMinutes * MS_PER_MINUTE)
    .toISOString()
    .slice(0, 10);
}

export function currentMonthString(offsetMinutes = 0): string {
  return new Date(Date.now() + offsetMinutes * MS_PER_MINUTE)
    .toISOString()
    .slice(0, 7);
}
