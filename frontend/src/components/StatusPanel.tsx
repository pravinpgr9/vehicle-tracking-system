import type { Vehicle, VehicleStatus } from '../api/types';
import { formatKm } from '../lib/format';
import './StatusPanel.css';

interface StatusPanelProps {
  vehicle: Vehicle;
  status: VehicleStatus;
  speedKmh: number | null;
  todayTrips: number;
  todayDistanceKm: number;
  deviceOnline: boolean;
}

export function StatusPanel({
  vehicle,
  status,
  speedKmh,
  todayTrips,
  todayDistanceKm,
  deviceOnline,
}: StatusPanelProps) {
  const isMoving = (speedKmh ?? 0) > 0;

  return (
    <div className="status-panel">
      <h2>{vehicle.name}</h2>
      <p className="status-line">
        <span
          className={`status-dot ${isMoving ? 'moving' : 'idle'}`}
          aria-hidden
        />
        {status === 'INACTIVE' ? 'Inactive' : isMoving ? 'Moving' : 'Stopped'}
        {!deviceOnline && <span className="offline-badge">device offline</span>}
      </p>
      <div className="status-metrics">
        <div>
          <span className="metric-value">{speedKmh?.toFixed(0) ?? '—'}</span>
          <span className="metric-label">km/h</span>
        </div>
        <div>
          <span className="metric-value">{todayTrips}</span>
          <span className="metric-label">today's trips</span>
        </div>
        <div>
          <span className="metric-value">{formatKm(todayDistanceKm)}</span>
          <span className="metric-label">today's distance</span>
        </div>
      </div>
    </div>
  );
}
