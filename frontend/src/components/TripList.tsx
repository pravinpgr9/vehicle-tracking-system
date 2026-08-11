import type { Trip } from '../api/types';
import { formatDuration, formatKm, formatTripRange } from '../lib/format';
import './TripList.css';

const METERS_PER_KM = 1000;

interface TripListProps {
  trips: Trip[];
}

export function TripList({ trips }: TripListProps) {
  if (trips.length === 0) {
    return <p className="trip-list-empty">No trips recorded yet.</p>;
  }

  return (
    <ul className="trip-list">
      {trips.map((trip) => (
        <li key={trip.id}>
          <div className="trip-range">
            {formatTripRange(trip.startedAt, trip.endedAt)}
          </div>
          <div className="trip-meta">
            {formatKm(trip.distanceMeters / METERS_PER_KM)} ·{' '}
            {formatDuration(trip.durationSeconds)}
            {trip.status === 'ACTIVE' && (
              <span className="trip-active-badge">in progress</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
