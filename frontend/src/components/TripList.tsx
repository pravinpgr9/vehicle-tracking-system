import type { Geofence, Trip } from '../api/types';
import { formatDuration, formatKm, formatRelativeDate, formatTime } from '../lib/format';
import { labelPoint } from '../lib/locationLabels';
import './TripList.css';

const METERS_PER_KM = 1000;

interface TripListProps {
  trips: Trip[];
  geofences: Geofence[];
}

function routeLabel(trip: Trip, geofences: Geofence[]): string {
  const from = labelPoint(
    { latitude: trip.startLatitude, longitude: trip.startLongitude },
    geofences,
  );
  const to =
    trip.endLatitude != null && trip.endLongitude != null
      ? labelPoint({ latitude: trip.endLatitude, longitude: trip.endLongitude }, geofences)
      : 'current location';
  return `${from} → ${to}`;
}

export function TripList({ trips, geofences }: TripListProps) {
  if (trips.length === 0) {
    return <p className="trip-list-empty">No trips recorded yet.</p>;
  }

  return (
    <ul className="trip-list">
      {trips.map((trip) => (
        <li key={trip.id} className="trip-row">
          <div className="trip-row-icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v4a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-4a2 2 0 0 0-2-2M7.5 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2m9 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2"
              />
            </svg>
          </div>
          <div className="trip-row-body">
            <div className="trip-row-top">
              <span className="trip-route">{routeLabel(trip, geofences)}</span>
              {trip.status === 'ACTIVE' && (
                <span className="trip-active-badge">in progress</span>
              )}
            </div>
            <div className="trip-row-meta">
              <span>{formatRelativeDate(trip.startedAt)}</span>
              <span className="trip-row-dot">·</span>
              <span>
                {formatTime(trip.startedAt)}
                {trip.endedAt ? ` – ${formatTime(trip.endedAt)}` : ''}
              </span>
              <span className="trip-row-dot">·</span>
              <span>{formatKm(trip.distanceMeters / METERS_PER_KM)}</span>
              <span className="trip-row-dot">·</span>
              <span>{formatDuration(trip.durationSeconds)}</span>
              {trip.maxSpeed > 0 && (
                <>
                  <span className="trip-row-dot">·</span>
                  <span>max {Math.round(trip.maxSpeed)} km/h</span>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
