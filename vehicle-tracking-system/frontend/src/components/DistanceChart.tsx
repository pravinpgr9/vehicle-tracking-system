import { useMemo, useState } from 'react';
import type { Trip } from '../api/types';
import './DistanceChart.css';

const METERS_PER_KM = 1000;
const DAYS_TO_SHOW = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

interface DayBucket {
  key: string;
  label: string;
  km: number;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function buildBuckets(trips: Trip[]): DayBucket[] {
  const today = startOfDay(new Date());
  const buckets: DayBucket[] = Array.from({ length: DAYS_TO_SHOW }, (_, i) => {
    const dayStart = today - (DAYS_TO_SHOW - 1 - i) * MILLISECONDS_PER_DAY;
    const date = new Date(dayStart);
    return {
      key: date.toDateString(),
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
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
}

export function DistanceChart({ trips }: DistanceChartProps) {
  const buckets = useMemo(() => buildBuckets(trips), [trips]);
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
