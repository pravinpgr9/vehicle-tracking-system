import { useEffect, useState } from 'react';
import './TripFilters.css';

export type PresetKey = 'today' | 'yesterday' | '7d' | '30d';

export interface TripDateFilter {
  from?: string;
  to?: string;
  label: string;
  presetKey?: PresetKey;
}

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

export function presetRange(key: PresetKey): TripDateFilter {
  const now = new Date();
  switch (key) {
    case 'today':
      return {
        from: startOfDay(now).toISOString(),
        to: endOfDay(now).toISOString(),
        label: 'Today',
        presetKey: key,
      };
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        from: startOfDay(yesterday).toISOString(),
        to: endOfDay(yesterday).toISOString(),
        label: 'Yesterday',
        presetKey: key,
      };
    }
    case '7d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return {
        from: startOfDay(start).toISOString(),
        to: endOfDay(now).toISOString(),
        label: 'Last 7 days',
        presetKey: key,
      };
    }
    case '30d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return {
        from: startOfDay(start).toISOString(),
        to: endOfDay(now).toISOString(),
        label: 'Last 30 days',
        presetKey: key,
      };
    }
  }
}

export const DEFAULT_TRIP_FILTER = presetRange('7d');

function toDateInputValue(iso?: string): string {
  return iso ? iso.slice(0, 10) : '';
}

interface TripFiltersProps {
  value: TripDateFilter;
  onChange: (filter: TripDateFilter) => void;
}

export function TripFilters({ value, onChange }: TripFiltersProps) {
  // Kept as local state (rather than derived purely from `value`) so a
  // partial custom selection — the user has picked "from" but not "to"
  // yet — survives re-renders instead of being wiped back to '' because
  // `value` still reflects the last preset/complete range.
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue(value.from));
  const [customTo, setCustomTo] = useState(() => toDateInputValue(value.to));

  // Picking a preset should clear any in-progress custom selection so the
  // date inputs don't keep showing a stale range once a preset is active.
  useEffect(() => {
    if (value.presetKey) {
      setCustomFrom('');
      setCustomTo('');
    }
  }, [value.presetKey]);

  function handleFromChange(from: string): void {
    setCustomFrom(from);
    if (from && customTo) {
      onChange({
        from: startOfDay(new Date(from)).toISOString(),
        to: endOfDay(new Date(customTo)).toISOString(),
        label: `${from} → ${customTo}`,
      });
    }
  }

  function handleToChange(to: string): void {
    setCustomTo(to);
    if (customFrom && to) {
      onChange({
        from: startOfDay(new Date(customFrom)).toISOString(),
        to: endOfDay(new Date(to)).toISOString(),
        label: `${customFrom} → ${to}`,
      });
    }
  }

  return (
    <div className="trip-filters">
      <div className="trip-filters-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`trip-filter-btn${value.presetKey === preset.key ? ' trip-filter-btn--active' : ''}`}
            onClick={() => onChange(presetRange(preset.key))}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="trip-filters-custom">
        <input
          type="date"
          value={customFrom}
          max={customTo || undefined}
          onChange={(e) => handleFromChange(e.target.value)}
          aria-label="From date"
        />
        <span className="trip-filters-custom-sep">–</span>
        <input
          type="date"
          value={customTo}
          min={customFrom || undefined}
          onChange={(e) => handleToChange(e.target.value)}
          aria-label="To date"
        />
      </div>
    </div>
  );
}
