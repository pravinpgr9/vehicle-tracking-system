import { useMemo, useState } from 'react';
import type { Trip } from '../api/types';
import './DistanceChart.css';

const METERS_PER_KM = 1000;
const DEFAULT_DAYS_TO_SHOW = 7;
// A custom range can span an arbitrary number of days; cap how many bars we
// render so the chart stays legible (it scrolls horizontally beyond a
// screen's worth of bars rather than squeezing them illegibly thin).
const MAX_BUCKETS = 62;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

interface DayBucket {
  key: string;
  label: string;
  km: number;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function buildBuckets(trips: Trip[], from?: string, to?: string): DayBucket[] {
  const end = to ? startOfDay(new Date(to)) : startOfDay(new Date());
  const defaultStart = end - (DEFAULT_DAYS_TO_SHOW - 1) * MILLISECONDS_PER_DAY;
  const requestedStart = from ? startOfDay(new Date(from)) : defaultStart;
  const requestedDays =
    Math.round((end - requestedStart) / MILLISECONDS_PER_DAY) + 1;
  const days = Math.min(Math.max(requestedDays, 1), MAX_BUCKETS);
  // If the range is wider than MAX_BUCKETS, keep the most recent `days`
  // days of it rather than the oldest.
  const start = end - (days - 1) * MILLISECONDS_PER_DAY;
  const labelFormat: Intl.DateTimeFormatOptions =
    days > 10 ? { day: 'numeric', month: 'short' } : { weekday: 'short' };

  const buckets: DayBucket[] = Array.from({ length: days }, (_, i) => {
    const dayStart = start + i * MILLISECONDS_PER_DAY;
    const date = new Date(dayStart);
    return {
      key: date.toDateString(),
      label: date.toLocaleDateString(undefined, labelFormat),
      km: 0,
    };
  });
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const trip of trips) {
    const key = new Date(trip.startedAt).toDateString();
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.km += trip.distanceMeters / METERS_PER_KM;
    }
  }
  return buckets;
}

interface DistanceChartProps {
  trips: Trip[];
  from?: string;
  to?: string;
}

export function DistanceChart({ trips, from, to }: DistanceChartProps) {
  const buckets = useMemo(() => buildBuckets(trips, from, to), [trips, from, to]);
  const [hovered, setHovered] = useState<string | null>(null);
  const maxKm = Math.max(1, ...buckets.map((b) => b.km));

  return (
    <div className="distance-chart">
      {buckets.map((bucket) => {
        const heightPct = Math.max(3, (bucket.km / maxKm) * 100);
        const isHovered = hovered === bucket.key;
        return (
          <div
            key={bucket.key}
            className="distance-chart-col"
            onMouseEnter={() => setHovered(bucket.key)}
            onMouseLeave={() => setHovered(null)}
          >
            {isHovered && (
              <div className="distance-chart-tooltip">{bucket.km.toFixed(1)} km</div>
            )}
            <div className="distance-chart-track">
              <div
                className={`distance-chart-bar${bucket.km === 0 ? ' distance-chart-bar--empty' : ''}`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="distance-chart-label">{bucket.label}</span>
          </div>
        );
      })}
    </div>
  );
}
